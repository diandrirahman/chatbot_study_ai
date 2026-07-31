import { Router } from 'express'
import { generateStudyPlan } from '../services/geminiService.js'
import { validateChatRequest } from '../validators/chatRequest.js'

const validate = (request, _response, next) => {
  try { request.validatedPayload = validateChatRequest(request.body); next() } catch (error) { next(error) }
}

export function createChatRouter(generatePlan = generateStudyPlan, usageGuards = []) {
  const router = Router()

  router.post('/', validate, ...usageGuards, async (request, response, next) => {
    try {
      const data = await generatePlan(request.validatedPayload)
      response.status(200).json({ success: true, data })
    } catch (error) {
      next(error)
    }
  })

  return router
}

export default createChatRouter()
