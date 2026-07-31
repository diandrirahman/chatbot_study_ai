import express from 'express'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { createChatRouter } from './routes/chat.js'
import { createLearningRouter } from './routes/learning.js'

export function createApp({ generateStudyPlan, learningService } = {}) {
  const app = express()
  app.use(express.json({ limit: '100kb' }))
  app.get('/api/health', (_request, response) => response.status(200).json({ success: true, message: 'StudyMate AI API is running' }))
  app.use('/api/chat', createChatRouter(generateStudyPlan))
  app.use('/api/learning', createLearningRouter(learningService))
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}

export default createApp()
