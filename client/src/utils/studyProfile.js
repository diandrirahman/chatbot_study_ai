export const PROFILE_STORAGE_KEY = 'studymate.profile.v1'
export const HISTORY_STORAGE_KEY = 'studymate.history.v1'
export const PLAN_STORAGE_KEY = 'studymate.plan.v1'
export const MAX_HISTORY_MESSAGES = 10
export const MAX_HISTORY_CHARACTERS = 12000

const levels = new Set(['beginner', 'intermediate', 'advanced'])
const styles = new Set(['reading', 'video', 'practice', 'project', 'combination'])
const intensities = new Set(['relaxed', 'normal', 'intensive'])
const languages = new Set(['id', 'en'])
const days = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
const inRange = (value, min, max) => Number.isInteger(value) && value >= min && value <= max

export const createEmptyProfile = () => ({ subject: '', goal: '', level: 'beginner', durationDays: 14, dailyMinutes: 60, studyDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'], learningStyle: 'practice', intensity: 'normal', language: 'id' })

export function validateProfile(profile) {
  const errors = {}
  const subject = typeof profile?.subject === 'string' ? profile.subject.trim() : ''
  const goal = typeof profile?.goal === 'string' ? profile.goal.trim() : ''
  if (subject.length < 2 || subject.length > 100) errors.subject = 'Subject must contain 2-100 characters.'
  if (goal.length < 5 || goal.length > 500) errors.goal = 'Learning goal must contain 5-500 characters.'
  if (!levels.has(profile?.level)) errors.level = 'Choose a valid current level.'
  if (!inRange(profile?.durationDays, 1, 365)) errors.durationDays = 'Duration must be a whole number from 1-365 days.'
  if (!inRange(profile?.dailyMinutes, 15, 480)) errors.dailyMinutes = 'Daily time must be a whole number from 15-480 minutes.'
  if (!Array.isArray(profile?.studyDays) || !profile.studyDays.length || new Set(profile.studyDays).size !== profile.studyDays.length || profile.studyDays.some((day) => !days.has(day))) errors.studyDays = 'Choose at least one valid study day.'
  if (!styles.has(profile?.learningStyle)) errors.learningStyle = 'Choose a valid learning style.'
  if (!intensities.has(profile?.intensity)) errors.intensity = 'Choose a valid intensity.'
  if (!languages.has(profile?.language)) errors.language = 'Choose a valid plan language.'
  return errors
}

const profileStepFields = {
  1: ['subject', 'goal', 'level', 'language'],
  2: ['durationDays', 'dailyMinutes', 'studyDays'],
  3: ['learningStyle', 'intensity'],
}

export function validateProfileStep(profile, step) {
  const errors = validateProfile(profile)
  return Object.fromEntries(
    (profileStepFields[step] ?? []).filter((field) => errors[field]).map((field) => [field, errors[field]]),
  )
}

export function validateAdjustmentMessage(message) {
  const value = typeof message === 'string' ? message.trim() : ''
  return value.length >= 1 && value.length <= 2000 ? '' : 'Adjustment message must contain 1-2,000 characters.'
}

export function isStorableProfile(profile) {
  return Boolean(profile) && typeof profile.subject === 'string' && typeof profile.goal === 'string' && levels.has(profile.level) && Number.isInteger(profile.durationDays) && Number.isInteger(profile.dailyMinutes) && Array.isArray(profile.studyDays) && new Set(profile.studyDays).size === profile.studyDays.length && profile.studyDays.every((day) => days.has(day)) && styles.has(profile.learningStyle) && intensities.has(profile.intensity) && languages.has(profile.language)
}

export function normalizeTranscript(history) {
  if (!Array.isArray(history)) return null
  const normalized = []
  for (const item of history) {
    if (!item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string' || !item.content.trim()) return null
    const message = { role: item.role, content: item.content.trim() }
    if (item.role === 'assistant' && ['focused-answer', 'plan-adjustment', 'target-change'].includes(item.responseType)) message.responseType = item.responseType
    normalized.push(message)
  }
  return normalized
}

export function boundHistory(history) {
  const normalized = normalizeTranscript(history)
  if (normalized === null) return null

  const recent = normalized.slice(-MAX_HISTORY_MESSAGES)
  const exchanges = []
  for (let index = 0; index < recent.length; index += 1) {
    const current = recent[index]
    const next = recent[index + 1]
    if (current.role === 'user' && next?.role === 'assistant') {
      exchanges.push([current, next])
      index += 1
    }
  }

  const result = []
  let chars = 0
  for (const exchange of exchanges.reverse()) {
    const exchangeCharacters = exchange.reduce((total, item) => total + item.content.length, 0)
    if (chars + exchangeCharacters > MAX_HISTORY_CHARACTERS) break
    result.unshift(...exchange.map(({ role, content }) => ({ role, content })))
    chars += exchangeCharacters
  }
  return result
}
