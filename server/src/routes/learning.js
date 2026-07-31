import { Router } from 'express'
import { learningService as defaultService } from '../services/learningService.js'
import { validateQuizRequest, validateSessionsRequest } from '../validators/learningRequest.js'

const validate = (validator) => (request, _response, next) => {
  try { request.validatedPayload = validator(request.body); next() } catch (error) { next(error) }
}

export function createLearningRouter(service = defaultService, usageGuards = []) {
  const router = Router()
  router.post('/sessions', validate(validateSessionsRequest), ...usageGuards, async (request, response, next) => {
    try { response.status(200).json({ success: true, data: await service.generateSessions(request.validatedPayload) }) } catch (error) { next(error) }
  })
  router.post('/quiz', validate(validateQuizRequest), ...usageGuards, async (request, response, next) => {
    try { response.status(200).json({ success: true, data: await service.generateQuiz(request.validatedPayload) }) } catch (error) { next(error) }
  })
  return router
}
