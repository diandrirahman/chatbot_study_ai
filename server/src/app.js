import express from 'express'
import cors from 'cors'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { createAiUsageGuards } from './middleware/usageLimit.js'
import { createChatRouter } from './routes/chat.js'
import { createLearningRouter } from './routes/learning.js'

function allowedOrigins(environment) {
  const configured = String(environment.ALLOWED_ORIGINS ?? '').split(',').map((item) => item.trim().replace(/\/$/, '')).filter(Boolean)
  if (environment.NODE_ENV !== 'production') configured.push('http://localhost:5173')
  return new Set(configured)
}

export function createApp({ generateStudyPlan, learningService, environment = process.env, usageStore, usageGuards } = {}) {
  const app = express()
  app.set('trust proxy', 1)
  const origins = allowedOrigins(environment)
  app.use(cors({ origin: (origin, callback) => callback(null, !origin || origins.has(origin.replace(/\/$/, ''))) }))
  app.use(express.json({ limit: '100kb' }))
  const guards = usageGuards ?? createAiUsageGuards({ environment, store: usageStore })
  app.get('/api/health', (_request, response) => response.status(200).json({ success: true, message: 'StudyMate AI API is running' }))
  app.use('/api/chat', createChatRouter(generateStudyPlan, guards))
  app.use('/api/learning', createLearningRouter(learningService, guards))
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}

export default createApp
