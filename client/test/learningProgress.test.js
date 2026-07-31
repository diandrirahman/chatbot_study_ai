import assert from 'node:assert/strict'
import test from 'node:test'
import { nextTick } from 'vue'

const database = new Map()
global.window = { localStorage: { getItem: (key) => database.get(key) ?? null, setItem: (key, value) => database.set(key, value), removeItem: (key) => database.delete(key) } }

const { useLearningProgress, LEARNING_STORAGE_KEY, LEARNING_STORAGE_KEYS } = await import('../src/composables/useLearningProgress.js')
const profile = { subject: 'React', goal: 'Build an app', level: 'beginner', durationDays: 14, dailyMinutes: 60, studyDays: ['monday'], learningStyle: 'practice', intensity: 'normal', language: 'en' }
const session = (id = 's1') => ({ id, order: 1, title: 'JSX', objective: 'Understand JSX', studyDay: 'monday', durationMinutes: 60, milestone: 'Foundation', activities: [{ id: `${id}-material`, type: 'material', title: 'Read', description: 'Read JSX' }, { id: `${id}-practice`, type: 'practice', title: 'Practice', description: 'Write JSX' }] })
const quiz = { id: 'qz', sessionId: 's1', questions: Array.from({ length: 5 }, (_, index) => ({ id: `q${index}`, prompt: `Question ${index}`, options: ['a','b','c','d'].map((id) => ({ id, text: id })), correctOptionId: 'a', explanation: 'Because' })), references: [], generatedAt: new Date().toISOString() }

test('learning sessions, activities, quiz attempts, and progress persist', async () => {
  database.clear(); let quizCalls = 0
  const learning = useLearningProgress({ api: { requestSessions: async () => ({ sessions: [session()] }), requestQuiz: async () => { quizCalls += 1; return { quiz } } } })
  assert.equal(await learning.generateSessions(profile, '# Plan'), true)
  learning.toggleActivity('s1', 'material'); learning.toggleActivity('s1', 'practice')
  assert.equal(await learning.ensureQuiz(profile, session()), true); assert.equal(await learning.ensureQuiz(profile, session()), true); assert.equal(quizCalls, 1)
  for (const question of quiz.questions) learning.answerQuestion('s1', question.id, question.id === 'q4' ? 'b' : 'a')
  assert.equal(learning.submitQuiz('s1'), true)
  assert.equal(learning.progress.s1.bestScore, 80); assert.equal(learning.sessionStatus('s1'), 'completed'); assert.equal(learning.completionPercent.value, 100); assert.equal(learning.masteryPercent.value, 80)
  for (const key of Object.values(LEARNING_STORAGE_KEYS)) assert.ok(database.has(key))
})

test('low quiz score completes the session with needs-review and retry keeps best score', async () => {
  database.clear(); const learning = useLearningProgress({ api: { requestSessions: async () => ({ sessions: [session()] }), requestQuiz: async () => ({ quiz }) } })
  await learning.generateSessions(profile, '# Plan'); learning.toggleActivity('s1', 'material'); learning.toggleActivity('s1', 'practice'); await learning.ensureQuiz(profile, session())
  for (const question of quiz.questions) learning.answerQuestion('s1', question.id, question.id === 'q0' ? 'a' : 'b')
  learning.submitQuiz('s1'); assert.equal(learning.progress.s1.bestScore, 20); assert.equal(learning.sessionStatus('s1'), 'needs-review'); assert.equal(learning.completionPercent.value, 100)
  learning.retryQuiz('s1'); for (const question of quiz.questions) learning.answerQuestion('s1', question.id, 'a'); learning.submitQuiz('s1')
  assert.equal(learning.progress.s1.bestScore, 100); assert.equal(learning.sessionStatus('s1'), 'completed'); assert.equal(learning.progress.s1.attempts.length, 2)
})

test('next session navigation is unlocked, persisted, and does not create a quiz', async () => {
  database.clear(); let quizCalls = 0
  const secondSession = { ...session('s2'), order: 2, title: 'Components' }
  const api = { requestSessions: async () => ({ sessions: [session(), secondSession] }), requestQuiz: async () => { quizCalls += 1; return { quiz } } }
  const learning = useLearningProgress({ api })
  await learning.generateSessions(profile, '# Plan')
  assert.equal(learning.nextSession.value.id, 's2')
  assert.equal(learning.selectNextSession(), true)
  assert.equal(learning.selectedSession.value.id, 's2')
  assert.equal(learning.nextSession.value, null)
  assert.equal(quizCalls, 0)
  await nextTick()
  const restored = useLearningProgress({ api })
  assert.equal(restored.selectedSession.value.id, 's2')
})

test('selective resync preserves matching progress while reset removes it', async () => {
  database.clear(); let nextSessions = [session()]
  const learning = useLearningProgress({ api: { requestSessions: async () => ({ sessions: nextSessions }), requestQuiz: async () => ({ quiz }) } })
  await learning.generateSessions(profile, '# Plan'); learning.toggleActivity('s1', 'material')
  nextSessions = [session('s1'), { ...session('s2'), order: 2 }]; await learning.generateSessions(profile, '# Revised')
  assert.equal(learning.progress.s1.materialCompleted, true); assert.equal(learning.progress.s2.materialCompleted, false)
  await learning.generateSessions(profile, '# Target changed', { reset: true }); assert.equal(learning.progress.s1.materialCompleted, false)
})

test('corrupted learning storage restores an empty safe state', () => {
  database.set(LEARNING_STORAGE_KEYS.sessions, '{broken')
  database.set(LEARNING_STORAGE_KEYS.progress, '{}')
  database.set(LEARNING_STORAGE_KEYS.quizzes, '{}')
  database.set(LEARNING_STORAGE_KEYS.attempts, '{}')
  const learning = useLearningProgress({ api: {} })
  assert.deepEqual(learning.sessions.value, []); assert.equal(database.has(LEARNING_STORAGE_KEY), false)
})
