import { RequestValidationError, validateProfile } from './chatRequest.js'

const fail = () => { throw new RequestValidationError('Invalid request') }
const isText = (value, min, max) => typeof value === 'string' && value.trim().length >= min && value.length <= max

export function validateSessionsRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail()
  validateProfile(body.profile)
  if (!isText(body.planMarkdown, 1, 60000)) fail()
  if (body.previousSessions !== undefined) {
    if (!Array.isArray(body.previousSessions) || body.previousSessions.length > 365) fail()
    for (const session of body.previousSessions) {
      if (!session || !isText(session.id, 1, 100) || !isText(session.title, 1, 300) || !Number.isInteger(session.order)) fail()
    }
  }
  if (body.adjustment !== undefined && (!body.adjustment || !isText(body.adjustment.message, 1, 2000) || !isText(body.adjustment.answer, 1, 60000))) fail()
  return { profile: body.profile, planMarkdown: body.planMarkdown, previousSessions: body.previousSessions ?? [], adjustment: body.adjustment }
}

export function validateQuizRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail()
  validateProfile(body.profile)
  const session = body.session
  if (!session || !isText(session.id, 1, 100) || !isText(session.title, 1, 300) || !isText(session.objective, 1, 1000)) fail()
  if (!Number.isInteger(session.durationMinutes) || session.durationMinutes < 1 || session.durationMinutes > body.profile.dailyMinutes) fail()
  if (!Array.isArray(session.activities) || session.activities.length < 2 || session.activities.length > 10) fail()
  return { profile: body.profile, session }
}
