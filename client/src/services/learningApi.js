export class LearningRequestError extends Error {}

const post = async (path, payload, fetchImplementation = globalThis.fetch) => {
  let response
  try { response = await fetchImplementation(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }) } catch { throw new LearningRequestError('Network request failed') }
  let body
  try { body = await response.json() } catch { throw new LearningRequestError('Invalid API response') }
  if (!response.ok || body?.success !== true || !body.data) throw new LearningRequestError(body?.error?.code ?? 'API request failed')
  return body.data
}

export const createLearningApi = (fetchImplementation = globalThis.fetch) => ({
  requestSessions: (payload) => post('/api/learning/sessions', payload, fetchImplementation),
  requestQuiz: (payload) => post('/api/learning/quiz', payload, fetchImplementation),
})

export const learningApi = createLearningApi()
