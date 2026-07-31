import { Firestore } from '@google-cloud/firestore'
import { rateLimit } from 'express-rate-limit'

const ONE_HOUR_MS = 60 * 60 * 1000
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

export function createFirestoreUsageStore({ firestore = new Firestore(), collection = 'studymate_usage_limits' } = {}) {
  return {
    async consume({ key, limit, now }) {
      const reference = firestore.collection(collection).doc(`ai-${key}`)
      return firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference)
        const count = Number(snapshot.exists ? snapshot.data()?.count : 0) || 0
        if (count >= limit) return { allowed: false, count }
        transaction.set(reference, { count: count + 1, updatedAt: now.toISOString() }, { merge: true })
        return { allowed: true, count: count + 1 }
      })
    },
  }
}

export function createDailyUsageMiddleware({ store, limit, timeZone = 'Asia/Jakarta', clock = () => new Date() }) {
  if (!store || !asPositiveInteger(limit)) return passThrough
  return async function dailyUsageMiddleware(_request, _response, next) {
    const now = clock()
    const window = dailyWindow(now, timeZone)
    try {
      const result = await store.consume({ key: window.key, limit: asPositiveInteger(limit), now })
      if (!result.allowed) throw new UsageLimitError('RATE_LIMITED', 429, window.retryAfterSeconds)
      next()
    } catch (error) {
      next(error instanceof UsageLimitError ? error : new UsageLimitError('AI_SERVICE_ERROR', 503))
    }
  }
}

export function createHourlyIpMiddleware({ limit }) {
  const parsedLimit = asPositiveInteger(limit)
  if (!parsedLimit) return passThrough
  return rateLimit({
    windowMs: ONE_HOUR_MS,
    limit: parsedLimit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_request, response) => {
      response.set('Retry-After', String(3600))
      response.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' } })
    },
  })
}

export function createAiUsageGuards({ environment = process.env, store } = {}) {
  const dailyLimit = asPositiveInteger(environment.AI_DAILY_LIMIT)
  const hourlyLimit = asPositiveInteger(environment.AI_HOURLY_IP_LIMIT)
  if (!dailyLimit && !hourlyLimit) return []
  const usageStore = dailyLimit ? (store ?? createFirestoreUsageStore()) : null
  return [
    createHourlyIpMiddleware({ limit: hourlyLimit }),
    createDailyUsageMiddleware({ store: usageStore, limit: dailyLimit, timeZone: environment.APP_TIMEZONE || 'Asia/Jakarta' }),
  ]
}
