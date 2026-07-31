import { randomUUID } from 'node:crypto'
import { GoogleGenAI } from '@google/genai'
import { GeminiServiceError } from './geminiService.js'
import { buildQuizPrompt, buildSessionsPrompt } from '../prompts/learningPrompt.js'

const DAYS = new Set(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'])
const safeJson = (text) => { try { return JSON.parse(String(text).replace(/^```json\s*|\s*```$/g, '')) } catch { throw new GeminiServiceError('AI_SERVICE_ERROR') } }
const safeUrl = (value) => { try { const url = new URL(value); return ['http:','https:'].includes(url.protocol) ? url.href : null } catch { return null } }
const withTimeout = (promise, timeoutMs) => new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new GeminiServiceError('AI_SERVICE_ERROR')), timeoutMs); promise.then(resolve, reject).finally(() => clearTimeout(timer)) })

export function createLearningService({ environment = process.env, clientFactory, timeoutMs = 30000 } = {}) {
  const client = () => {
    if (!environment.GEMINI_API_KEY || !environment.GEMINI_MODEL) throw new GeminiServiceError('INTERNAL_ERROR')
    return (clientFactory ?? ((key) => new GoogleGenAI({ apiKey: key, httpOptions: { timeout: timeoutMs } })))(environment.GEMINI_API_KEY)
  }
  const generate = async (prompt) => {
    try {
      const providerRequest = client().models.generateContent({ model: environment.GEMINI_MODEL, contents: prompt, config: { responseMimeType: 'application/json' } })
      const response = await withTimeout(providerRequest, timeoutMs)
      return safeJson(response?.text)
    } catch (error) {
      if (error instanceof GeminiServiceError) throw error
      if (error?.status === 429 || error?.statusCode === 429) throw new GeminiServiceError('RATE_LIMITED')
      throw new GeminiServiceError('AI_SERVICE_ERROR')
    }
  }
  return {
    async generateSessions(payload) {
      const data = await generate(buildSessionsPrompt(payload))
      if (!Array.isArray(data.sessions) || !data.sessions.length || data.sessions.length > 365) throw new GeminiServiceError('AI_SERVICE_ERROR')
      const usedPrevious = new Set()
      const sessions = data.sessions.map((item, index) => {
        if (!item || !Number.isInteger(item.order) || typeof item.title !== 'string' || !item.title.trim() || typeof item.objective !== 'string' || !item.objective.trim() || !DAYS.has(item.studyDay) || !payload.profile.studyDays.includes(item.studyDay) || !Number.isInteger(item.durationMinutes) || item.durationMinutes < 1 || item.durationMinutes > payload.profile.dailyMinutes || !Array.isArray(item.activities)) throw new GeminiServiceError('AI_SERVICE_ERROR')
        const previous = payload.previousSessions.find((entry) => entry.id === item.previousId)
        const id = previous && !usedPrevious.has(previous.id) ? previous.id : randomUUID()
        usedPrevious.add(id)
        const activities = ['material','practice'].map((type) => {
          const activity = item.activities.find((entry) => entry?.type === type)
          if (!activity || typeof activity.title !== 'string' || !activity.title.trim() || typeof activity.description !== 'string' || !activity.description.trim()) throw new GeminiServiceError('AI_SERVICE_ERROR')
          return { id: `${id}-${type}`, type, title: activity.title.trim(), description: activity.description.trim() }
        })
        return { id, order: index + 1, title: item.title.trim(), objective: item.objective.trim(), studyDay: item.studyDay, durationMinutes: item.durationMinutes, milestone: typeof item.milestone === 'string' ? item.milestone.trim() : '', activities }
      })
      return { sessions, generatedAt: new Date().toISOString() }
    },
    async generateQuiz(payload) {
      const data = await generate(buildQuizPrompt(payload))
      if (!Array.isArray(data.questions) || data.questions.length !== 5) throw new GeminiServiceError('AI_SERVICE_ERROR')
      const questions = data.questions.map((question) => {
        if (!question || typeof question.prompt !== 'string' || !question.prompt.trim() || !Array.isArray(question.options) || question.options.length !== 4 || !['a','b','c','d'].includes(question.correctOptionId) || typeof question.explanation !== 'string' || !question.explanation.trim()) throw new GeminiServiceError('AI_SERVICE_ERROR')
        const ids = question.options.map((option) => option?.id)
        if (new Set(ids).size !== 4 || !ids.every((id) => ['a','b','c','d'].includes(id)) || question.options.some((option) => typeof option.text !== 'string' || !option.text.trim())) throw new GeminiServiceError('AI_SERVICE_ERROR')
        return { id: randomUUID(), prompt: question.prompt.trim(), options: question.options.map((option) => ({ id: option.id, text: option.text.trim() })), correctOptionId: question.correctOptionId, explanation: question.explanation.trim() }
      })
      const references = Array.isArray(data.references) ? data.references.slice(0, 3).filter((ref) => ref && typeof ref.title === 'string').map((ref) => ({ title: ref.title.trim(), url: safeUrl(ref.url) })) : []
      return { quiz: { id: randomUUID(), sessionId: payload.session.id, questions, references, generatedAt: new Date().toISOString() } }
    },
  }
}

export const learningService = createLearningService()
