import { Router } from 'express'
import { learningService as defaultService } from '../services/learningService.js'
import { validateQuizRequest, validateSessionsRequest } from '../validators/learningRequest.js'

export function createLearningRouter(service = defaultService) {
  const router = Router()
  router.post('/sessions', async (request, response, next) => {
    try { response.status(200).json({ success: true, data: await service.generateSessions(validateSessionsRequest(request.body)) }) } catch (error) { next(error) }
  })
  router.post('/quiz', async (request, response, next) => {
    try { response.status(200).json({ success: true, data: await service.generateQuiz(validateQuizRequest(request.body)) }) } catch (error) { next(error) }
  })
  return router
}
