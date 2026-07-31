import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../src/app.js'
import { GeminiServiceError, createGeminiService } from '../src/services/geminiService.js'
import { buildStudyPlanPrompt } from '../src/prompts/studyPlanPrompt.js'
import { classifyResponseType } from '../src/prompts/studyPlanPrompt.js'
import { createLearningService } from '../src/services/learningService.js'

const receivedPayloads = []
const server = createApp({
  generateStudyPlan: async (payload) => {
    receivedPayloads.push(payload)
    return { answer: '# Rencana Belajar\n\nRespons Gemini mock.', generatedAt: new Date().toISOString() }
  },
  learningService: {
    generateSessions: async () => ({ sessions: [{ id: 'session-1', order: 1, title: 'JSX', objective: 'Memahami JSX', studyDay: 'monday', durationMinutes: 60, milestone: 'Dasar', activities: [{ id: 'm', type: 'material', title: 'Materi', description: 'Baca' }, { id: 'p', type: 'practice', title: 'Praktik', description: 'Latihan' }] }], generatedAt: new Date().toISOString() }),
    generateQuiz: async (body) => ({ quiz: { id: 'quiz-1', sessionId: body.session.id, questions: Array.from({ length: 5 }, (_, index) => ({ id: `q${index}`, prompt: `Q${index}`, options: ['a','b','c','d'].map((id) => ({ id, text: id })), correctOptionId: 'a', explanation: 'Explanation' })), references: [], generatedAt: new Date().toISOString() } }),
  },
}).listen(0)
const baseUrl = `http://127.0.0.1:${server.address().port}`

test.after(() => server.close())

const profile = {
  subject: 'React.js', goal: 'Mampu membuat website sederhana', level: 'beginner', durationDays: 14,
  dailyMinutes: 120, studyDays: ['monday', 'tuesday'], learningStyle: 'practice', intensity: 'normal', language: 'id',
}

const payload = (overrides = {}) => ({ mode: 'create-study-plan', message: 'Buatkan rencana belajar React.', profile, history: [], ...overrides })
const postChat = async (body) => {
  const response = await fetch(`${baseUrl}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { status: response.status, body: await response.json() }
}

test('GET /api/health returns the documented body', async () => {
  const response = await fetch(`${baseUrl}/api/health`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { success: true, message: 'StudyMate AI API is running' })
})

test('POST /api/chat returns Gemini-compatible success for a valid create request', async () => {
  const response = await postChat(payload())
  assert.equal(response.status, 200); assert.equal(response.body.success, true); assert.equal(typeof response.body.data.answer, 'string')
  assert.ok(!Number.isNaN(Date.parse(response.body.data.generatedAt)))
})

test('POST /api/chat accepts an adjustment with valid assistant and user history', async () => {
  const history = [{ role: 'user', content: 'Saya sudah memahami JSX.' }, { role: 'assistant', content: 'Bagus, lanjutkan ke state.' }]
  const response = await postChat(payload({ mode: 'adjust-study-plan', message: 'Pindahkan jadwal Sabtu ke Minggu.', history }))
  assert.equal(response.status, 200)
  assert.equal(receivedPayloads.at(-1).mode, 'adjust-study-plan')
  assert.deepEqual(receivedPayloads.at(-1).history, history)
})

test('learning endpoints return structured sessions and a five-question quiz', async () => {
  const sessionResponse = await fetch(`${baseUrl}/api/learning/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile, planMarkdown: '# Plan', previousSessions: [] }) })
  const sessionBody = await sessionResponse.json()
  assert.equal(sessionResponse.status, 200); assert.equal(sessionBody.data.sessions[0].studyDay, 'monday')
  const quizResponse = await fetch(`${baseUrl}/api/learning/quiz`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile, session: sessionBody.data.sessions[0] }) })
  const quizBody = await quizResponse.json()
  assert.equal(quizResponse.status, 200); assert.equal(quizBody.data.quiz.questions.length, 5)
})

test('learning endpoints reject invalid requests safely', async () => {
  const response = await fetch(`${baseUrl}/api/learning/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile, planMarkdown: '' }) })
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { success: false, error: { code: 'INVALID_REQUEST', message: 'Pesan aman untuk pengguna.' } })
})

for (const [name, invalidPayload] of [
  ['invalid mode', payload({ mode: 'other' })],
  ['invalid profile', payload({ profile: { ...profile, durationDays: 0 } })],
  ['empty adjustment message', payload({ mode: 'adjust-study-plan', message: ' ' })],
  ['empty create message', payload({ message: '' })],
  ['invalid history role', payload({ history: [{ role: 'system', content: 'No' }] })],
  ['history over 10 items', payload({ history: Array.from({ length: 11 }, () => ({ role: 'user', content: 'x' })) })],
  ['history over 12000 characters', payload({ history: [{ role: 'assistant', content: 'x'.repeat(12001) }] })],
]) {
  test(`POST /api/chat rejects ${name}`, async () => {
    const response = await postChat(invalidPayload)
    assert.equal(response.status, 400)
    assert.deepEqual(response.body, { success: false, error: { code: 'INVALID_REQUEST', message: 'Pesan aman untuk pengguna.' } })
  })
}

test('Gemini service builds create and adjustment context without exposing its key', async () => {
  const calls = []
  const service = createGeminiService({
    environment: { GEMINI_API_KEY: 'test-only-key', GEMINI_MODEL: 'test-model' },
    clientFactory: () => ({
      models: {
        generateContent: async (request) => {
          calls.push(request)
          return { text: '## Ringkasan target dan asumsi\nTest' }
        },
      },
    }),
  })
  await service(payload())
  await service(payload({ mode: 'adjust-study-plan', message: 'Kurangi durasi.', history: [{ role: 'assistant', content: 'Rencana sebelumnya.' }] }))
  assert.equal(calls.length, 2)
  assert.match(calls[0].config.systemInstruction, /## Ringkasan target dan asumsi/)
  assert.match(calls[0].config.systemInstruction, /## Tips konsistensi/)
  assert.match(calls[0].config.systemInstruction, /## Referensi materi/)
  assert.match(calls[0].config.systemInstruction, /without LaTeX syntax or dollar-delimited math/)
  assert.match(calls[0].config.systemInstruction, /without inventing a URL/)
  assert.equal(calls[1].contents[0].role, 'model')
  assert.equal(calls[1].contents.at(-1).role, 'user')
  assert.doesNotMatch(JSON.stringify(calls), /test-only-key/)
})

test('adjustment prompt preserves the main target unless the current request explicitly changes it', () => {
  const history = [{ role: 'user', content: 'Saya belajar React.' }, { role: 'assistant', content: 'Rencana React awal.' }]
  const timePrompt = buildStudyPlanPrompt({ ...payload({ mode: 'adjust-study-plan', message: 'Kurangi waktu belajar menjadi 60 menit per hari.', history }) })
  const targetPrompt = buildStudyPlanPrompt({ ...payload({ mode: 'adjust-study-plan', message: 'Ganti target dari React menjadi Vue.', history }) })
  assert.match(timePrompt.systemInstruction, /Do not treat an unrelated question as an implicit target change/)
  assert.match(timePrompt.systemInstruction, /Change the main target only when the current request explicitly says to replace or change it/)
  assert.match(timePrompt.systemInstruction, /return only the changed or directly relevant section/)
  assert.match(timePrompt.contents.at(-1).parts[0].text, /Kurangi waktu belajar menjadi 60 menit per hari/)
  assert.match(targetPrompt.contents.at(-1).parts[0].text, /Ganti target dari React menjadi Vue/)
  assert.equal(timePrompt.contents[0].role, 'user'); assert.equal(timePrompt.contents[1].role, 'model')
})

test('adjustment prompt rejects off-profile questions and answers focused plan questions directly', () => {
  const offProfile = buildStudyPlanPrompt({ ...payload({ mode: 'adjust-study-plan', message: 'Cara masak mie?', history: [] }) })
  const focused = buildStudyPlanPrompt({ ...payload({ mode: 'adjust-study-plan', message: 'Apa materi dan kuis hari pertama?', history: [] }) })
  assert.match(offProfile.systemInstruction, /reply with exactly this sentence and nothing else/)
  assert.match(offProfile.systemInstruction, /tidak sesuai dengan Study Profile Anda/)
  assert.match(focused.systemInstruction, /answer only that question in concise Markdown/)
  assert.match(focused.systemInstruction, /Do not repeat the target summary or the complete plan/)
  assert.match(focused.systemInstruction, /1-3 relevant learning references/)
  assert.match(focused.contents.at(-1).parts[0].text, /Apa materi dan kuis hari pertama/)
})

test('chat response classification distinguishes focused questions, adjustments, and target changes', () => {
  assert.equal(classifyResponseType('create-study-plan', 'Create'), 'plan-created')
  assert.equal(classifyResponseType('adjust-study-plan', 'Apa quiz hari pertama?'), 'focused-answer')
  assert.equal(classifyResponseType('adjust-study-plan', 'Kurangi waktu belajar menjadi 30 menit.'), 'plan-adjustment')
  assert.equal(classifyResponseType('adjust-study-plan', 'Ganti target dari React menjadi Vue.'), 'target-change')
})

test('learning Gemini service validates structured sessions and quiz output', async () => {
  const responses = [
    { sessions: [{ previousId: null, order: 1, title: 'JSX', objective: 'Understand JSX', studyDay: 'monday', durationMinutes: 60, milestone: 'Foundation', activities: [{ type: 'material', title: 'Read', description: 'Read JSX' }, { type: 'practice', title: 'Practice', description: 'Build JSX' }] }] },
    { questions: Array.from({ length: 5 }, (_, index) => ({ prompt: `Q${index}`, options: ['a','b','c','d'].map((id) => ({ id, text: id })), correctOptionId: 'a', explanation: 'Because' })), references: [{ title: 'MDN', url: 'https://developer.mozilla.org/' }, { title: 'Unsafe', url: 'javascript:alert(1)' }] },
  ]
  const service = createLearningService({ environment: { GEMINI_API_KEY: 'key', GEMINI_MODEL: 'model' }, clientFactory: () => ({ models: { generateContent: async () => ({ text: JSON.stringify(responses.shift()) }) } }) })
  const sessions = await service.generateSessions({ profile, planMarkdown: '# Plan', previousSessions: [] })
  assert.equal(sessions.sessions[0].durationMinutes, 60); assert.equal(sessions.sessions[0].activities.length, 2)
  const quiz = await service.generateQuiz({ profile, session: sessions.sessions[0] })
  assert.equal(quiz.quiz.questions.length, 5); assert.equal(quiz.quiz.references[0].url, 'https://developer.mozilla.org/'); assert.equal(quiz.quiz.references[1].url, null)
})

test('Gemini timeout and rate limit map to safe service codes', async () => {
  const timeoutService = createGeminiService({ environment: { GEMINI_API_KEY: 'key', GEMINI_MODEL: 'model' }, timeoutMs: 10, clientFactory: () => ({ models: { generateContent: () => new Promise(() => {}) } }) })
  await assert.rejects(() => timeoutService(payload()), (error) => error instanceof GeminiServiceError && error.code === 'AI_SERVICE_ERROR')
  const rateLimitService = createGeminiService({ environment: { GEMINI_API_KEY: 'key', GEMINI_MODEL: 'model' }, clientFactory: () => ({ models: { generateContent: async () => { const error = new Error('provider detail'); error.status = 429; throw error } } }) })
  await assert.rejects(() => rateLimitService(payload()), (error) => error instanceof GeminiServiceError && error.code === 'RATE_LIMITED')
})

test('provider errors produce a safe client response without raw details', async () => {
  const failingApp = createApp({ generateStudyPlan: async () => { throw new GeminiServiceError('RATE_LIMITED') } })
  const failingServer = failingApp.listen(0)
  try {
    const response = await fetch(`http://127.0.0.1:${failingServer.address().port}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) })
    const body = await response.json()
    assert.equal(body.error.code, 'RATE_LIMITED')
    assert.equal(body.error.message, 'Pesan aman untuk pengguna.')
    assert.doesNotMatch(JSON.stringify(body), /provider|key|stack/i)
  } finally {
    failingServer.close()
  }
})
