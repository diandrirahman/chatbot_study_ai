import { configuredApiBaseUrl, createApiUrl } from './apiUrl.js'

export class ChatRequestError extends Error {}

export function createChatApi(fetchImplementation = globalThis.fetch, baseUrl = configuredApiBaseUrl) {
  return async function requestChat(payload) {
    let response
    try {
      response = await fetchImplementation(createApiUrl('/api/chat', baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {
      throw new ChatRequestError('Network request failed')
    }

    let body
    try { body = await response.json() } catch { throw new ChatRequestError('Invalid API response') }
    if (!response.ok || body?.success !== true || typeof body?.data?.answer !== 'string' || typeof body?.data?.generatedAt !== 'string') {
      const error = new ChatRequestError(body?.error?.message || 'API request failed')
      error.code = body?.error?.code || 'API_REQUEST_FAILED'
      throw error
    }
    return body.data
  }
}

export const requestChat = createChatApi()
