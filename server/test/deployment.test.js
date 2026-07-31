import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../src/app.js'
import { createFirestoreUsageStore, dailyWindow } from '../src/middleware/usageLimit.js'
import { GeminiServiceError } from '../src/services/geminiService.js'

const profile = { subject: 'Matematika', goal: 'Memahami aljabar dasar', level: 'beginner', durationDays: 14, dailyMinutes: 60, studyDays: ['monday'], learningStyle: 'practice', intensity: 'normal', language: 'id' }
const payload = () => ({ mode: 'create-study-plan', message: 'Buatkan rencana belajar', profile, history: [] })
const post = (baseUrl, body = payload(), headers = {}) => fetch(`${baseUrl}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })

async function withServer(app, callback) {
  const server = app.listen(0)
  try { await callback(`http://127.0.0.1:${server.address().port}`) } finally { server.close() }
}

function memoryUsageStore(initialCount = 0) {
  let count = initialCount
  return { get count() { return count }, async consume({ limit }) { if (count >= limit) return { allowed: false, count }; count += 1; return { allowed: true, count } } }
}

test('daily window uses Asia/Jakarta and reports seconds until reset', () => {
  assert.deepEqual(dailyWindow(new Date('2026-07-31T16:59:50.000Z'), 'Asia/Jakarta'), { key: '2026-07-31', retryAfterSeconds: 10 })
  assert.equal(dailyWindow(new Date('2026-07-31T17:00:00.000Z'), 'Asia/Jakarta').key, '2026-08-01')
})

test('Firestore transaction allows only one concurrent request at the final slot', async () => {
  let count = 99
  let queue = Promise.resolve()
  const firestore = {
    collection: () => ({ doc: () => ({}) }),
    runTransaction(callback) {
      const execution = queue.then(() => callback({
        get: async () => ({ exists: true, data: () => ({ count }) }),
        set: (_reference, data) => { count = data.count },
      }))
      queue = execution.catch(() => {})
      return execution
    },
  }
  const store = createFirestoreUsageStore({ firestore })
  const results = await Promise.all([
    store.consume({ key: '2026-08-01', limit: 100, now: new Date() }),
    store.consume({ key: '2026-08-01', limit: 100, now: new Date() }),
  ])
  assert.deepEqual(results.map((result) => result.allowed), [true, false])
  assert.equal(count, 100)
})

test('health and invalid requests do not consume the daily AI quota', async () => {
  const store = memoryUsageStore()
  let providerCalls = 0
  const app = createApp({
    environment: { AI_DAILY_LIMIT: '1', AI_HOURLY_IP_LIMIT: '0', APP_TIMEZONE: 'Asia/Jakarta' },
    usageStore: store,
    generateStudyPlan: async () => { providerCalls += 1; return { answer: '# Plan', generatedAt: new Date().toISOString() } },
  })
  await withServer(app, async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200)
    assert.equal((await post(baseUrl, { ...payload(), mode: 'invalid' })).status, 400)
    assert.equal(store.count, 0)
    assert.equal((await post(baseUrl)).status, 200)
    const limited = await post(baseUrl)
    assert.equal(limited.status, 429)
    assert.equal((await limited.json()).error.code, 'RATE_LIMITED')
    assert.ok(Number(limited.headers.get('retry-after')) > 0)
    assert.equal(providerCalls, 1)
  })
})

test('provider failures consume quota and Firestore failures fail closed', async () => {
  const store = memoryUsageStore()
  let providerCalls = 0
  const failingProvider = createApp({
    environment: { AI_DAILY_LIMIT: '1', AI_HOURLY_IP_LIMIT: '0' }, usageStore: store,
    generateStudyPlan: async () => { providerCalls += 1; throw new GeminiServiceError('AI_SERVICE_ERROR') },
  })
  await withServer(failingProvider, async (baseUrl) => {
    assert.equal((await post(baseUrl)).status, 502)
    assert.equal((await post(baseUrl)).status, 429)
    assert.equal(providerCalls, 1)
  })

  const unavailableStore = createApp({
    environment: { AI_DAILY_LIMIT: '1', AI_HOURLY_IP_LIMIT: '0' },
    usageStore: { consume: async () => { throw new Error('private Firestore detail') } },
    generateStudyPlan: async () => { providerCalls += 1; return { answer: '# Plan', generatedAt: new Date().toISOString() } },
  })
  await withServer(unavailableStore, async (baseUrl) => {
    const response = await post(baseUrl)
    const body = await response.json()
    assert.equal(response.status, 503)
    assert.equal(body.error.code, 'AI_SERVICE_ERROR')
    assert.doesNotMatch(JSON.stringify(body), /Firestore|private/i)
    assert.equal(providerCalls, 1)
  })
})

test('hourly IP limiter blocks the next valid request and CORS only authorizes configured origins', async () => {
  const app = createApp({
    environment: { AI_DAILY_LIMIT: '0', AI_HOURLY_IP_LIMIT: '2', ALLOWED_ORIGINS: 'https://studymate.vercel.app', NODE_ENV: 'production' },
    generateStudyPlan: async () => ({ answer: '# Plan', generatedAt: new Date().toISOString() }),
  })
  await withServer(app, async (baseUrl) => {
    const allowed = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'https://studymate.vercel.app' } })
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://studymate.vercel.app')
    const blocked = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'https://attacker.example' } })
    assert.equal(blocked.headers.get('access-control-allow-origin'), null)
    assert.equal((await post(baseUrl)).status, 200)
    assert.equal((await post(baseUrl)).status, 200)
    const limited = await post(baseUrl)
    assert.equal(limited.status, 429)
    assert.equal((await limited.json()).error.code, 'RATE_LIMITED')
  })
})
