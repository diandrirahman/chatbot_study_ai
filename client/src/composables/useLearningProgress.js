import { computed, reactive, ref, watch } from 'vue'
import { learningApi as defaultApi } from '../services/learningApi.js'

export const LEARNING_STORAGE_KEYS = Object.freeze({
  sessions: 'studymate.learning.sessions.v1',
  progress: 'studymate.learning.progress.v1',
  quizzes: 'studymate.learning.quizzes.v1',
  attempts: 'studymate.learning.attempts.v1',
})
export const LEARNING_STORAGE_KEY = LEARNING_STORAGE_KEYS.sessions
const MAX_CACHED_QUIZZES = 30
const storage = () => { try { return window.localStorage } catch { return null } }
const isActivity = (item) => item && ['material', 'practice'].includes(item.type) && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.description === 'string'
const validSession = (session) => session && typeof session.id === 'string' && Number.isInteger(session.order) && typeof session.title === 'string' && typeof session.objective === 'string' && typeof session.studyDay === 'string' && Number.isInteger(session.durationMinutes) && Array.isArray(session.activities) && session.activities.every(isActivity)
const validAttempt = (item) => item && Number.isFinite(item.score) && item.score >= 0 && item.score <= 100 && item.answers && typeof item.answers === 'object' && typeof item.submittedAt === 'string'
const validQuiz = (quiz) => quiz === null || (quiz && typeof quiz.id === 'string' && Array.isArray(quiz.questions) && quiz.questions.length === 5 && quiz.questions.every((question) => question && typeof question.id === 'string' && typeof question.prompt === 'string' && Array.isArray(question.options) && question.options.length === 4 && question.options.every((option) => option && ['a', 'b', 'c', 'd'].includes(option.id) && typeof option.text === 'string') && ['a', 'b', 'c', 'd'].includes(question.correctOptionId) && typeof question.explanation === 'string') && Array.isArray(quiz.references))
const validProgress = (item) => item && typeof item.materialCompleted === 'boolean' && typeof item.practiceCompleted === 'boolean' && item.answers && typeof item.answers === 'object' && (item.bestScore === null || Number.isFinite(item.bestScore)) && typeof item.showResult === 'boolean'
const defaultProgress = () => ({ materialCompleted: false, practiceCompleted: false, quiz: null, answers: {}, attempts: [], bestScore: null, showResult: false })

function clearStoredLearning(store) {
  Object.values(LEARNING_STORAGE_KEYS).forEach((key) => { try { store?.removeItem(key) } catch {} })
}

function parseVersioned(store, key) {
  const raw = store.getItem(key)
  if (raw === null) return null
  const value = JSON.parse(raw)
  if (value?.version !== 1) throw new Error('Invalid learning state')
  return value
}

function restore() {
  const store = storage()
  if (!store) return { sessions: [], progress: {}, selectedSessionId: null }
  try {
    const stored = Object.values(LEARNING_STORAGE_KEYS).map((key) => store.getItem(key))
    if (stored.every((value) => value === null)) return { sessions: [], progress: {}, selectedSessionId: null }
    if (stored.some((value) => value === null)) throw new Error('Incomplete learning state')
    const sessionState = parseVersioned(store, LEARNING_STORAGE_KEYS.sessions)
    const progressState = parseVersioned(store, LEARNING_STORAGE_KEYS.progress)
    const quizState = parseVersioned(store, LEARNING_STORAGE_KEYS.quizzes)
    const attemptState = parseVersioned(store, LEARNING_STORAGE_KEYS.attempts)
    if (!Array.isArray(sessionState.sessions) || !sessionState.sessions.every(validSession) || !progressState.items || !quizState.items || !attemptState.items) throw new Error('Invalid learning state')
    const progress = {}
    for (const session of sessionState.sessions) {
      const base = progressState.items[session.id]
      const quiz = quizState.items[session.id] ?? null
      const attempts = attemptState.items[session.id] ?? []
      if (!validProgress(base) || !validQuiz(quiz) || !Array.isArray(attempts) || !attempts.every(validAttempt)) throw new Error('Invalid learning state')
      progress[session.id] = { ...base, quiz, attempts }
    }
    return { sessions: sessionState.sessions, progress, selectedSessionId: sessionState.selectedSessionId ?? null }
  } catch {
    clearStoredLearning(store)
    return { sessions: [], progress: {}, selectedSessionId: null }
  }
}

export function useLearningProgress({ api = defaultApi, waitForBackend = async () => true } = {}) {
  const saved = restore()
  const sessions = ref(saved.sessions)
  const progress = reactive(saved.progress)
  const selectedSessionId = ref(saved.selectedSessionId)
  const sessionsLoading = ref(false); const sessionsError = ref(''); const quizLoadingId = ref(null); const quizError = ref('')

  const ensureProgress = (id) => { if (!progress[id]) progress[id] = defaultProgress(); return progress[id] }
  sessions.value.forEach((session) => ensureProgress(session.id))
  const selectedSession = computed(() => sessions.value.find((session) => session.id === selectedSessionId.value) ?? sessions.value.find((session) => !isSessionComplete(session.id)) ?? sessions.value[0] ?? null)
  const nextSession = computed(() => {
    const currentIndex = sessions.value.findIndex((session) => session.id === selectedSession.value?.id)
    return currentIndex >= 0 ? sessions.value[currentIndex + 1] ?? null : null
  })
  const completedCount = computed(() => sessions.value.filter((session) => isSessionComplete(session.id)).length)
  const completionPercent = computed(() => sessions.value.length ? Math.round(completedCount.value / sessions.value.length * 100) : 0)
  const attempted = computed(() => sessions.value.map((session) => progress[session.id]?.bestScore).filter((score) => Number.isFinite(score)))
  const masteryPercent = computed(() => attempted.value.length ? Math.round(attempted.value.reduce((sum, score) => sum + score, 0) / attempted.value.length) : 0)

  function isSessionComplete(id) { const item = progress[id]; return Boolean(item?.materialCompleted && item?.practiceCompleted && item?.attempts?.length) }
  function sessionStatus(id) {
    const item = progress[id]
    if (!item || (!item.materialCompleted && !item.practiceCompleted && !item.attempts?.length)) return 'not-started'
    if (!isSessionComplete(id)) return 'in-progress'
    return item.bestScore < 70 ? 'needs-review' : 'completed'
  }
  function persistencePayloads() {
    const progressItems = {}; const quizItems = {}; const attemptItems = {}
    sessions.value.forEach((session) => {
      const item = ensureProgress(session.id)
      progressItems[session.id] = { materialCompleted: item.materialCompleted, practiceCompleted: item.practiceCompleted, answers: item.answers, bestScore: item.bestScore, showResult: item.showResult }
      quizItems[session.id] = item.quiz
      attemptItems[session.id] = item.attempts
    })
    return {
      [LEARNING_STORAGE_KEYS.sessions]: { version: 1, sessions: sessions.value, selectedSessionId: selectedSessionId.value },
      [LEARNING_STORAGE_KEYS.progress]: { version: 1, items: progressItems },
      [LEARNING_STORAGE_KEYS.quizzes]: { version: 1, items: quizItems },
      [LEARNING_STORAGE_KEYS.attempts]: { version: 1, items: attemptItems },
    }
  }
  function writePayloads(store) {
    const payloads = persistencePayloads()
    Object.entries(payloads).forEach(([key, value]) => store.setItem(key, JSON.stringify(value)))
  }
  function persist() {
    const store = storage(); if (!store) return
    if (!sessions.value.length) { clearStoredLearning(store); return }
    try { writePayloads(store) } catch {
      try {
        const cached = sessions.value.filter((session) => progress[session.id]?.quiz)
        cached.slice(0, Math.max(0, cached.length - MAX_CACHED_QUIZZES)).forEach((session) => { progress[session.id].quiz = null; progress[session.id].answers = {}; progress[session.id].showResult = false })
        writePayloads(store)
      } catch { /* persistence must never crash the application */ }
    }
  }
  watch([sessions, progress, selectedSessionId], persist, { deep: true })

  async function generateSessions(profile, planMarkdown, { adjustment, reset = false } = {}) {
    if (sessionsLoading.value) return false
    sessionsLoading.value = true; sessionsError.value = ''
    try {
      if (!await waitForBackend()) throw new Error('Backend unavailable')
      const previousSessions = reset ? [] : sessions.value.map(({ id, order, title, objective }) => ({ id, order, title, objective }))
      const data = await api.requestSessions({ profile: { ...profile, studyDays: [...profile.studyDays] }, planMarkdown, previousSessions, adjustment })
      if (!Array.isArray(data.sessions) || !data.sessions.every(validSession)) throw new Error('Invalid sessions')
      const previousProgress = { ...progress }
      Object.keys(progress).forEach((id) => { delete progress[id] })
      sessions.value = data.sessions
      sessions.value.forEach((session) => { progress[session.id] = !reset && previousProgress[session.id] ? previousProgress[session.id] : defaultProgress() })
      selectedSessionId.value = sessions.value.find((session) => !isSessionComplete(session.id))?.id ?? sessions.value[0]?.id ?? null
      persist(); return true
    } catch (error) { sessionsError.value = error?.code === 'RATE_LIMITED' ? 'rate-limited' : 'sessions-load-failed'; return false }
    finally { sessionsLoading.value = false }
  }
  function selectSession(id) { if (sessions.value.some((session) => session.id === id)) selectedSessionId.value = id }
  function selectNextSession() { if (!nextSession.value) return false; selectSession(nextSession.value.id); return true }
  function toggleActivity(id, type) { const item = ensureProgress(id); if (type === 'material') item.materialCompleted = !item.materialCompleted; if (type === 'practice') item.practiceCompleted = !item.practiceCompleted }
  async function ensureQuiz(profile, session, force = false) {
    const item = ensureProgress(session.id); if (item.quiz && !force) return true
    if (quizLoadingId.value) return false
    quizLoadingId.value = session.id; quizError.value = ''
    try { if (!await waitForBackend()) throw new Error('Backend unavailable'); const data = await api.requestQuiz({ profile: { ...profile, studyDays: [...profile.studyDays] }, session }); if (!validQuiz(data.quiz)) throw new Error('Invalid quiz'); item.quiz = data.quiz; item.answers = {}; item.showResult = false; persist(); return true }
    catch (error) { quizError.value = error?.code === 'RATE_LIMITED' ? 'rate-limited' : 'quiz-load-failed'; return false }
    finally { quizLoadingId.value = null }
  }
  function answerQuestion(sessionId, questionId, optionId) { const item = ensureProgress(sessionId); item.answers[questionId] = optionId; item.showResult = false; quizError.value = '' }
  function submitQuiz(sessionId) {
    const item = ensureProgress(sessionId); const questions = item.quiz?.questions ?? []
    if (questions.length !== 5 || questions.some((question) => !item.answers[question.id])) { quizError.value = 'quiz-incomplete'; return false }
    const correct = questions.filter((question) => item.answers[question.id] === question.correctOptionId).length
    const score = Math.round(correct / questions.length * 100)
    item.attempts.push({ score, answers: { ...item.answers }, submittedAt: new Date().toISOString() }); item.bestScore = Math.max(item.bestScore ?? 0, score); item.showResult = true; quizError.value = ''; persist(); return true
  }
  function retryQuiz(sessionId) { const item = ensureProgress(sessionId); item.answers = {}; item.showResult = false; quizError.value = '' }
  function clearLearning() { sessions.value = []; Object.keys(progress).forEach((id) => delete progress[id]); selectedSessionId.value = null; sessionsError.value = ''; quizError.value = ''; clearStoredLearning(storage()) }

  return { sessions, progress, selectedSessionId, selectedSession, nextSession, sessionsLoading, sessionsError, quizLoadingId, quizError, completedCount, completionPercent, masteryPercent, generateSessions, selectSession, selectNextSession, toggleActivity, ensureQuiz, answerQuestion, submitQuiz, retryQuiz, sessionStatus, isSessionComplete, clearLearning }
}
