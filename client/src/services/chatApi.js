export class ChatRequestError extends Error {}

export function createChatApi(fetchImplementation = globalThis.fetch) {
  return async function requestChat(payload) {
    let response
    try {
      response = await fetchImplementation('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {
      throw new ChatRequestError('Network request failed')
    }

    let body
    try { body = await response.json() } catch { throw new ChatRequestError('Invalid API response') }
    if (!response.ok || body?.success !== true || typeof body?.data?.answer !== 'string' || typeof body?.data?.generatedAt !== 'string') throw new ChatRequestError('API request failed')
    return body.data
  }
}

export const requestChat = createChatApi()
