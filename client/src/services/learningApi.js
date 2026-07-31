import { configuredApiBaseUrl, createApiUrl } from './apiUrl.js'

export class LearningRequestError extends Error {}

const post = async (path, payload, fetchImplementation = globalThis.fetch, baseUrl = configuredApiBaseUrl) => {
  let response
  try { response = await fetchImplementation(createApiUrl(path, baseUrl), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }) } catch { throw new LearningRequestError('Network request failed') }
  let body
  try { body = await response.json() } catch { throw new LearningRequestError('Invalid API response') }
  if (!response.ok || body?.success !== true || !body.data) {
    const error = new LearningRequestError(body?.error?.message ?? 'API request failed')
    error.code = body?.error?.code ?? 'API_REQUEST_FAILED'
    throw error
  }
  return body.data
}

export const createLearningApi = (fetchImplementation = globalThis.fetch, baseUrl = configuredApiBaseUrl) => ({
  requestSessions: (payload) => post('/api/learning/sessions', payload, fetchImplementation, baseUrl),
  requestQuiz: (payload) => post('/api/learning/quiz', payload, fetchImplementation, baseUrl),
})

export const learningApi = createLearningApi()
