const MODES = new Set(['create-study-plan', 'adjust-study-plan'])
const LEVELS = new Set(['beginner', 'intermediate', 'advanced'])
const LEARNING_STYLES = new Set(['reading', 'video', 'practice', 'project', 'combination'])
const INTENSITIES = new Set(['relaxed', 'normal', 'intensive'])
const LANGUAGES = new Set(['id', 'en'])
const STUDY_DAYS = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])

export class RequestValidationError extends Error {}

const fail = () => { throw new RequestValidationError('Invalid request') }
const isIntegerInRange = (value, minimum, maximum) => Number.isInteger(value) && value >= minimum && value <= maximum

export function validateProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) fail()
  if (typeof profile.subject !== 'string' || profile.subject.trim().length < 2 || profile.subject.trim().length > 100) fail()
  if (typeof profile.goal !== 'string' || profile.goal.trim().length < 5 || profile.goal.trim().length > 500) fail()
  if (!LEVELS.has(profile.level)) fail()
  if (!isIntegerInRange(profile.durationDays, 1, 365)) fail()
  if (!isIntegerInRange(profile.dailyMinutes, 15, 480)) fail()
  if (!Array.isArray(profile.studyDays) || profile.studyDays.length === 0 || new Set(profile.studyDays).size !== profile.studyDays.length || profile.studyDays.some((day) => !STUDY_DAYS.has(day))) fail()
  if (!LEARNING_STYLES.has(profile.learningStyle)) fail()
  if (!INTENSITIES.has(profile.intensity)) fail()
  if (!LANGUAGES.has(profile.language)) fail()
}

function validateHistory(history) {
  if (!Array.isArray(history) || history.length > 10) fail()
  let totalCharacters = 0
  for (const item of history) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string') fail()
    totalCharacters += item.content.length
  }
  if (totalCharacters > 12000) fail()
}

export function validateChatRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !MODES.has(body.mode)) fail()
  if (typeof body.message !== 'string') fail()
  if (body.mode === 'create-study-plan' && body.message.trim().length === 0) fail()
  if (body.mode === 'adjust-study-plan' && (body.message.trim().length < 1 || body.message.length > 2000)) fail()
  validateProfile(body.profile)
  validateHistory(body.history)
  return body
}
