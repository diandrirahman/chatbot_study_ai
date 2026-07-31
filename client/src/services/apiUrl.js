export const normalizeApiBaseUrl = (value = '') => String(value).trim().replace(/\/+$/, '')

export function createApiUrl(path, baseUrl = '') {
  const base = normalizeApiBaseUrl(baseUrl)
  return base ? `${base}${path}` : path
}

export const configuredApiBaseUrl = normalizeApiBaseUrl(import.meta.env?.VITE_API_BASE_URL)
