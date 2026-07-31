import { Router } from 'express'
import { generateStudyPlan } from '../services/geminiService.js'
import { validateChatRequest } from '../validators/chatRequest.js'

export function createChatRouter(generatePlan = generateStudyPlan) {
  const router = Router()

  router.post('/', async (request, response, next) => {
    try {
      const payload = validateChatRequest(request.body)
      const data = await generatePlan(payload)
      response.status(200).json({ success: true, data })
    } catch (error) {
      next(error)
    }
  })

  return router
}

export default createChatRouter()
