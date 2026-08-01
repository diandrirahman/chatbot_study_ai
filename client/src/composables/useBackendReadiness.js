import { ref } from 'vue'
import { configuredApiBaseUrl, createApiUrl } from '../services/apiUrl.js'

const HEALTH_MESSAGE = 'StudyMate AI API is running'

export function useBackendReadiness({
  fetchImplementation = globalThis.fetch,
  baseUrl = configuredApiBaseUrl,
  timeoutMs = 90000,
  freshForMs = 10 * 60 * 1000,
  clock = () => Date.now(),
} = {}) {
  const status = ref('idle')
  const error = ref('')
  let readyAt = 0
  let pending = null

  const isFresh = () => status.value === 'ready' && clock() - readyAt < freshForMs

  async function checkHealth() {
    if (isFresh()) return true
    if (pending) return pending

    status.value = 'warming'
    error.value = ''
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    pending = (async () => {
      try {
        const response = await fetchImplementation(createApiUrl('/api/health', baseUrl), {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        const body = await response.json()
        if (!response.ok || body?.success !== true || body?.message !== HEALTH_MESSAGE) throw new Error('Invalid health response')
        readyAt = clock()
        status.value = 'ready'
        return true
      } catch {
        status.value = 'unavailable'
        error.value = 'Backend is temporarily unavailable.'
        return false
      } finally {
        clearTimeout(timeout)
        pending = null
      }
    })()

    return pending
  }

  return { status, error, warmUp: checkHealth, ensureReady: checkHealth, retry: checkHealth }
}
