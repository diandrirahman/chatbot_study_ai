import assert from 'node:assert/strict'
import test from 'node:test'

const database = new Map()
global.window = {
  localStorage: {
    getItem: (key) => database.has(key) ? database.get(key) : null,
    setItem: (key, value) => database.set(key, value),
    removeItem: (key) => database.delete(key),
  },
}

const { useStudyPlanner } = await import('../src/composables/useStudyPlanner.js')
const { useBackendReadiness } = await import('../src/composables/useBackendReadiness.js')
const { createChatApi } = await import('../src/services/chatApi.js')
const { boundHistory, validateProfileStep } = await import('../src/utils/studyProfile.js')

const response = (answer = '# Plan') => ({ ok: true, json: async () => ({ success: true, data: { answer, generatedAt: new Date().toISOString() } }) })
const validProfile = (planner) => { planner.profile.subject = 'React.js'; planner.profile.goal = 'Mampu membuat website sederhana' }
const clearStorage = () => database.clear()

test('backend pre-warm coalesces concurrent checks and reuses a fresh success', async () => {
  let resolveHealth
  const calls = []
  const readiness = useBackendReadiness({
    baseUrl: 'https://api.example.com',
    clock: () => 1000,
    fetchImplementation: (url) => {
      calls.push(url)
      return new Promise((resolve) => { resolveHealth = resolve })
    },
  })
  const first = readiness.warmUp()
  const second = readiness.ensureReady()
  assert.equal(readiness.status.value, 'warming')
  assert.equal(calls.length, 1)
  resolveHealth({ ok: true, json: async () => ({ success: true, message: 'StudyMate AI API is running' }) })
  assert.deepEqual(await Promise.all([first, second]), [true, true])
  assert.equal(readiness.status.value, 'ready')
  assert.equal(await readiness.ensureReady(), true)
  assert.equal(calls.length, 1)
})

test('generate waits for backend readiness and still prevents double submit', async () => {
  clearStorage(); let releaseBackend; const calls = []
  const planner = useStudyPlanner({
    waitForBackend: () => new Promise((resolve) => { releaseBackend = resolve }),
    requestChat: async (payload) => { calls.push(payload); return { answer: '# Ready plan', generatedAt: new Date().toISOString() } },
  })
  validProfile(planner)
  const first = planner.submitProfile()
  assert.equal(await planner.submitProfile(), false)
  assert.equal(planner.isSubmitting.value, true)
  assert.equal(calls.length, 0)
  releaseBackend(true)
  assert.equal(await first, true)
  assert.equal(calls.length, 1)
})

test('backend readiness failure preserves input and retry can recover', async () => {
  clearStorage(); let ready = false; let calls = 0
  const planner = useStudyPlanner({
    waitForBackend: async () => ready,
    requestChat: async () => { calls += 1; return { answer: '# Recovered', generatedAt: new Date().toISOString() } },
  })
  validProfile(planner); planner.adjustmentMessage.value = 'Kurangi intensitas belajar.'
  assert.equal(await planner.submitAdjustment(), false)
  assert.equal(planner.adjustmentMessage.value, 'Kurangi intensitas belajar.')
  assert.equal(calls, 0)
  ready = true
  assert.equal(await planner.retryRequest(), true)
  assert.equal(calls, 1)
})

test('three-step validation only reports fields belonging to the active step', () => {
  const profile = { subject: '', goal: '', level: 'beginner', language: 'id', durationDays: 0, dailyMinutes: 0, studyDays: [], learningStyle: 'practice', intensity: 'normal' }
  assert.deepEqual(Object.keys(validateProfileStep(profile, 1)).sort(), ['goal', 'subject'])
  assert.deepEqual(Object.keys(validateProfileStep(profile, 2)).sort(), ['dailyMinutes', 'durationDays', 'studyDays'])
  assert.deepEqual(validateProfileStep(profile, 3), {})
})

test('chat API uses native fetch with the documented endpoint and JSON body', async () => {
  const calls = []
  const requestChat = createChatApi(async (url, options) => { calls.push({ url, options }); return response('# API plan') })
  const data = await requestChat({ mode: 'create-study-plan', message: 'Create a plan', profile: {}, history: [] })
  assert.equal(calls.length, 1); assert.equal(calls[0].url, '/api/chat'); assert.equal(calls[0].options.method, 'POST')
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json'); assert.equal(JSON.parse(calls[0].options.body).mode, 'create-study-plan'); assert.equal(data.answer, '# API plan')
})

test('production API base URL is applied without a trailing slash', async () => {
  const calls = []
  const requestChat = createChatApi(async (url) => { calls.push(url); return response('# Deployed plan') }, 'https://api.example.com/')
  await requestChat({ mode: 'create-study-plan', message: 'Create a plan', profile: {}, history: [] })
  assert.deepEqual(calls, ['https://api.example.com/api/chat'])
})

test('generate sends one valid create request and prevents double submit', async () => {
  clearStorage(); let resolveFetch; const calls = []
  const planner = useStudyPlanner({ requestChat: (payload) => { calls.push(payload); return new Promise((resolve) => { resolveFetch = resolve }) } })
  validProfile(planner)
  const first = planner.submitProfile()
  const second = await planner.submitProfile()
  assert.equal(planner.isSubmitting.value, true); assert.equal(second, false); assert.equal(calls.length, 1)
  assert.equal(planner.pendingMessage.value, calls[0].message); assert.equal(planner.history.value.length, 0)
  assert.equal(calls[0].mode, 'create-study-plan'); assert.equal(calls[0].history.length, 0); assert.ok(calls[0].message.length > 0)
  resolveFetch({ answer: '# Rencana Belajar', generatedAt: new Date().toISOString() })
  assert.equal(await first, true); assert.equal(planner.pendingMessage.value, ''); assert.equal(planner.history.value.length, 2); assert.equal(planner.history.value[1].role, 'assistant')
})

test('adjustment uses bounded history and appends the successful response', async () => {
  clearStorage(); const calls = []
  const planner = useStudyPlanner({ requestChat: async (payload) => { calls.push(payload); return { answer: '# Revisi', generatedAt: new Date().toISOString() } } })
  validProfile(planner)
  planner.history.value = Array.from({ length: 12 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `message ${index}` }))
  planner.adjustmentMessage.value = 'Pindahkan jadwal Sabtu ke Minggu.'
  assert.equal(await planner.submitAdjustment(), true)
  assert.equal(calls[0].mode, 'adjust-study-plan'); assert.equal(calls[0].history.length, 10); assert.equal(calls[0].message, 'Pindahkan jadwal Sabtu ke Minggu.')
  assert.equal(planner.history.value.at(-1).content, '# Revisi')
})

test('adjustment cannot send a request without a valid Study Profile', async () => {
  clearStorage(); const calls = []
  const planner = useStudyPlanner({ requestChat: async (payload) => { calls.push(payload); return { answer: '# Tidak boleh terkirim', generatedAt: new Date().toISOString() } } })
  planner.adjustmentMessage.value = 'Halo'
  assert.equal(await planner.submitAdjustment(), false)
  assert.equal(calls.length, 0)
  assert.ok(planner.profileErrors.value.subject)
  assert.ok(planner.profileErrors.value.goal)
  assert.equal(planner.conversationState.value, 'empty')
})

test('adjustment scenarios keep the profile target and send valid bounded context', async () => {
  clearStorage(); const calls = []
  const planner = useStudyPlanner({ requestChat: async (payload) => { calls.push(payload); return { answer: '# Revisi aman', generatedAt: new Date().toISOString() } } })
  validProfile(planner)
  planner.history.value = [{ role: 'user', content: 'Saya ingin menguasai React.' }, { role: 'assistant', content: '# Rencana React awal' }]
  const adjustments = [
    'Kurangi waktu belajar menjadi 60 menit per hari.',
    'Saya hanya bisa belajar Senin, Rabu, dan Jumat.',
    'Buat intensitas lebih santai.',
    'Ganti target dari React menjadi Vue.',
  ]
  for (const message of adjustments) {
    planner.adjustmentMessage.value = message
    assert.equal(await planner.submitAdjustment(), true)
  }
  assert.equal(calls.length, 4)
  for (const call of calls) {
    assert.equal(call.mode, 'adjust-study-plan'); assert.equal(call.profile.subject, 'React.js'); assert.equal(call.profile.goal, 'Mampu membuat website sederhana')
    assert.ok(call.history.length <= 10); assert.ok(call.history.every((item) => ['user', 'assistant'].includes(item.role) && item.content.trim().length > 0))
    assert.ok(call.history.reduce((total, item) => total + item.content.length, 0) <= 12000)
  }
  assert.equal(calls.at(-1).message, 'Ganti target dari React menjadi Vue.')
})

test('adjustment history does not send more than 12000 characters', async () => {
  clearStorage(); const calls = []
  const planner = useStudyPlanner({ requestChat: async (payload) => { calls.push(payload); return { answer: '# Revisi', generatedAt: new Date().toISOString() } } })
  validProfile(planner)
  planner.history.value = [{ role: 'assistant', content: 'x'.repeat(12001) }]
  planner.adjustmentMessage.value = 'Buat intensitas lebih santai.'
  assert.equal(await planner.submitAdjustment(), true)
  assert.deepEqual(calls[0].history, [])
})

test('bounded history keeps complete user-assistant exchanges instead of orphaned user messages', () => {
  const history = [
    { role: 'user', content: 'Pertanyaan lama' },
    { role: 'assistant', content: 'x'.repeat(7000) },
    { role: 'user', content: 'Materi hari pertama apa?' },
    { role: 'assistant', content: 'y'.repeat(7000) },
  ]
  const bounded = boundHistory(history)
  assert.equal(bounded.length, 2)
  assert.deepEqual(bounded.map((item) => item.role), ['user', 'assistant'])
  assert.equal(bounded[0].content, 'Materi hari pertama apa?')
  assert.ok(bounded.reduce((total, item) => total + item.content.length, 0) <= 12000)

  const cleaned = boundHistory([
    { role: 'user', content: 'Pesan lama tanpa respons' },
    { role: 'user', content: 'Pertanyaan terbaru' },
    { role: 'assistant', content: 'Jawaban terbaru' },
  ])
  assert.deepEqual(cleaned, [
    { role: 'user', content: 'Pertanyaan terbaru' },
    { role: 'assistant', content: 'Jawaban terbaru' },
  ])
})

test('failed request preserves adjustment input and retry resends it', async () => {
  clearStorage(); let attempt = 0
  const planner = useStudyPlanner({ requestChat: async () => { attempt += 1; if (attempt === 1) throw new Error('network'); return { answer: '# Recovered', generatedAt: new Date().toISOString() } } })
  validProfile(planner); planner.adjustmentMessage.value = 'Make the plan lighter.'
  assert.equal(await planner.submitAdjustment(), false); assert.equal(planner.adjustmentMessage.value, 'Make the plan lighter.'); assert.equal(planner.conversationState.value, 'error')
  assert.equal(planner.pendingMessage.value, '')
  assert.equal(await planner.retryRequest(), true); assert.equal(attempt, 2); assert.equal(planner.adjustmentMessage.value, ''); assert.equal(planner.history.value.at(-1).content, '# Recovered')
})

test('rate limited request preserves input and exposes a safe localized message', async () => {
  clearStorage()
  const limited = new Error('provider detail'); limited.code = 'RATE_LIMITED'
  const planner = useStudyPlanner({ requestChat: async () => { throw limited } })
  validProfile(planner); planner.adjustmentMessage.value = 'Kurangi waktu belajar.'
  assert.equal(await planner.submitAdjustment(), false)
  assert.equal(planner.adjustmentMessage.value, 'Kurangi waktu belajar.')
  assert.equal(planner.requestError.value, 'Batas penggunaan telah tercapai. Silakan coba lagi nanti.')
  assert.equal(planner.history.value.length, 0)
})

test('clear plan resets profile, history, and persisted state', async () => {
  clearStorage()
  const planner = useStudyPlanner({ requestChat: async () => ({ answer: '# Saved plan', generatedAt: new Date().toISOString() }) })
  validProfile(planner); await planner.submitProfile()
  const restored = useStudyPlanner({ requestChat: async () => response() })
  assert.equal(restored.conversationState.value, 'restored'); assert.equal(restored.profile.subject, 'React.js'); assert.equal(restored.history.value.length, 2)
  restored.clearPlan()
  assert.equal(restored.history.value.length, 0); assert.equal(restored.profile.subject, ''); assert.equal(restored.profile.goal, ''); assert.equal(restored.conversationState.value, 'empty')
  assert.equal(database.has('studymate.profile.v1'), false); assert.equal(database.has('studymate.history.v1'), false)
})
