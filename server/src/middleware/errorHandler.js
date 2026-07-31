import { RequestValidationError } from '../validators/chatRequest.js'
import { GeminiServiceError } from '../services/geminiService.js'
import { UsageLimitError } from './usageLimit.js'

const safeError = (code, message) => ({ success: false, error: { code, message } })

export function notFoundHandler(_request, response) {
  response.status(404).json(safeError('NOT_FOUND', 'Endpoint tidak ditemukan.'))
}

export function errorHandler(error, _request, response, _next) {
  if (error instanceof UsageLimitError) {
    if (error.retryAfterSeconds) response.set('Retry-After', String(error.retryAfterSeconds))
    const message = error.code === 'RATE_LIMITED' ? 'Batas penggunaan hari ini telah tercapai. Silakan coba lagi besok.' : 'Layanan sementara tidak tersedia. Silakan coba lagi nanti.'
    response.status(error.status).json(safeError(error.code, message))
    return
  }
  if (error instanceof RequestValidationError || error?.type === 'entity.parse.failed') {
    response.status(400).json(safeError('INVALID_REQUEST', 'Pesan aman untuk pengguna.'))
    return
  }
  if (error instanceof GeminiServiceError) {
    const status = error.code === 'INTERNAL_ERROR' ? 500 : error.code === 'RATE_LIMITED' ? 429 : 502
    response.status(status).json(safeError(error.code, 'Pesan aman untuk pengguna.'))
    return
  }
  response.status(500).json(safeError('INTERNAL_ERROR', 'Pesan aman untuk pengguna.'))
}
