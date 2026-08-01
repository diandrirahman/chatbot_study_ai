import { Redis } from '@upstash/redis'
import { createHash } from 'node:crypto'

const passThrough = (_request, _response, next) => next()
const asPositiveInteger = (value) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0
}

export class UsageLimitError extends Error {
  constructor(code, status, retryAfterSeconds = null) {
    super(code)
    this.code = code
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export function zonedDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
}

export function dailyWindow(date, timeZone = 'Asia/Jakarta') {
  const parts = zonedDateParts(date, timeZone)
  const key = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
  const elapsedSeconds = parts.hour * 3600 + parts.minute * 60 + parts.second
  return { key, retryAfterSeconds: Math.max(1, 86400 - elapsedSeconds) }
}

export function hourlyWindow(date) {
  const hourStart = new Date(date)
  hourStart.setUTCMinutes(0, 0, 0)
  const key = hourStart.toISOString().slice(0, 13)
  const retryAfterSeconds = Math.max(1, Math.ceil((hourStart.getTime() + 3600000 - date.getTime()) / 1000))
  return { key, retryAfterSeconds }
}

const hashIp = (value) => createHash('sha256').update(String(value || 'unknown')).digest('hex')

const CONSUME_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(ARGV[1])
if current >= limit then
  return {0, current}
end
local next = redis.call('INCR', KEYS[1])
if next == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
end
return {1, next}
`

export function createUpstashUsageStore({ redis = Redis.fromEnv(), prefix = 'studymate:ai-usage' } = {}) {
  return {
    async consume({ key, limit, expiresInSeconds }) {
      const result = await redis.eval(CONSUME_SCRIPT, [`${prefix}:${key}`], [limit, Math.max(1, expiresInSeconds)])
      const allowed = Number(result?.[0]) === 1
      const count = Number(result?.[1]) || 0
      return { allowed, count }
    },
  }
}

export function createDailyUsageMiddleware({ store, limit, timeZone = 'Asia/Jakarta', clock = () => new Date() }) {
  if (!store || !asPositiveInteger(limit)) return passThrough
  return async function dailyUsageMiddleware(_request, _response, next) {
    const now = clock()
    const window = dailyWindow(now, timeZone)
    try {
      const result = await store.consume({ key: window.key, limit: asPositiveInteger(limit), expiresInSeconds: window.retryAfterSeconds })
      if (!result.allowed) throw new UsageLimitError('RATE_LIMITED', 429, window.retryAfterSeconds)
      next()
    } catch (error) {
      next(error instanceof UsageLimitError ? error : new UsageLimitError('AI_SERVICE_ERROR', 503))
    }
  }
}

export function createHourlyIpMiddleware({ store, limit, clock = () => new Date() }) {
  const parsedLimit = asPositiveInteger(limit)
  if (!store || !parsedLimit) return passThrough
  return async function hourlyIpMiddleware(request, _response, next) {
    const window = hourlyWindow(clock())
    try {
      const result = await store.consume({ key: `ip:${hashIp(request.ip)}:${window.key}`, limit: parsedLimit, expiresInSeconds: window.retryAfterSeconds })
      if (!result.allowed) throw new UsageLimitError('RATE_LIMITED', 429, window.retryAfterSeconds)
      next()
    } catch (error) {
      next(error instanceof UsageLimitError ? error : new UsageLimitError('AI_SERVICE_ERROR', 503))
    }
  }
}

export function createAiUsageGuards({ environment = process.env, store } = {}) {
  const dailyLimit = asPositiveInteger(environment.AI_DAILY_LIMIT)
  const hourlyLimit = asPositiveInteger(environment.AI_HOURLY_IP_LIMIT)
  if (!dailyLimit && !hourlyLimit) return []
  const usageStore = dailyLimit || hourlyLimit ? (store ?? createUpstashUsageStore()) : null
  return [
    createHourlyIpMiddleware({ store: usageStore, limit: hourlyLimit }),
    createDailyUsageMiddleware({ store: usageStore, limit: dailyLimit, timeZone: environment.APP_TIMEZONE || 'Asia/Jakarta' }),
  ]
}
