import { GoogleGenAI } from '@google/genai'
import { buildStudyPlanPrompt, classifyResponseType } from '../prompts/studyPlanPrompt.js'

export class GeminiServiceError extends Error {
  constructor(code) { super(code); this.code = code }
}

const DEFAULT_TIMEOUT_MS = 30000
const isRateLimitError = (error) => error?.status === 429 || error?.statusCode === 429 || error?.code === 429
const isTimeoutError = (error) => error?.name === 'AbortError' || error?.code === 'ETIMEDOUT' || error?.code === 'UND_ERR_CONNECT_TIMEOUT'

const withTimeout = (promise, timeoutMs) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new GeminiServiceError('AI_SERVICE_ERROR')), timeoutMs)
  promise.then(resolve, reject).finally(() => clearTimeout(timer))
})

export function createGeminiService({ environment = process.env, timeoutMs = DEFAULT_TIMEOUT_MS, clientFactory } = {}) {
  const createClient = clientFactory ?? ((apiKey) => new GoogleGenAI({ apiKey, httpOptions: { timeout: timeoutMs } }))

  return async function generateStudyPlan(payload) {
    const apiKey = environment.GEMINI_API_KEY
    const model = environment.GEMINI_MODEL
    if (!apiKey || !model) throw new GeminiServiceError('INTERNAL_ERROR')

    try {
      const client = createClient(apiKey)
      const prompt = buildStudyPlanPrompt(payload)
      const response = await withTimeout(client.models.generateContent({ model, contents: prompt.contents, config: { systemInstruction: prompt.systemInstruction } }), timeoutMs)
      if (typeof response?.text !== 'string' || response.text.trim().length === 0) throw new GeminiServiceError('AI_SERVICE_ERROR')
      return { answer: response.text.trim(), generatedAt: new Date().toISOString(), responseType: classifyResponseType(payload.mode, payload.message) }
    } catch (error) {
      if (error instanceof GeminiServiceError) throw error
      if (isRateLimitError(error)) throw new GeminiServiceError('RATE_LIMITED')
      if (isTimeoutError(error)) throw new GeminiServiceError('AI_SERVICE_ERROR')
      throw new GeminiServiceError('AI_SERVICE_ERROR')
    }
  }
}

export const generateStudyPlan = createGeminiService()
