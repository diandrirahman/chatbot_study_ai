import { RequestValidationError } from '../validators/chatRequest.js'
import { GeminiServiceError } from '../services/geminiService.js'

const safeError = (code, message) => ({ success: false, error: { code, message } })

export function notFoundHandler(_request, response) {
  response.status(404).json(safeError('NOT_FOUND', 'Endpoint tidak ditemukan.'))
}

export function errorHandler(error, _request, response, _next) {
  if (error instanceof RequestValidationError || error?.type === 'entity.parse.failed') {
    response.status(400).json(safeError('INVALID_REQUEST', 'Pesan aman untuk pengguna.'))
    return
  }
  if (error instanceof GeminiServiceError) {
    response.status(error.code === 'INTERNAL_ERROR' ? 500 : 502).json(safeError(error.code, 'Pesan aman untuk pengguna.'))
    return
  }
  response.status(500).json(safeError('INTERNAL_ERROR', 'Pesan aman untuk pengguna.'))
}
