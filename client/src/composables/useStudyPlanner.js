import { computed, reactive, ref, watch } from 'vue'
import { requestChat as defaultRequestChat } from '../services/chatApi.js'
import { HISTORY_STORAGE_KEY, PROFILE_STORAGE_KEY, boundHistory, createEmptyProfile, isStorableProfile, validateAdjustmentMessage, validateProfile } from '../utils/studyProfile.js'

const storage = () => { try { return window.localStorage } catch { return null } }
const copyProfile = (profile) => ({ ...profile, studyDays: [...profile.studyDays] })

function restoredState() {
  const store = storage()
  if (!store) return { profile: createEmptyProfile(), history: [], restored: false }
  try {
    const savedProfile = store.getItem(PROFILE_STORAGE_KEY); const savedHistory = store.getItem(HISTORY_STORAGE_KEY)
    if (savedProfile === null && savedHistory === null) return { profile: createEmptyProfile(), history: [], restored: false }
    if (savedProfile === null || savedHistory === null) throw new Error('Incomplete state')
    const profile = JSON.parse(savedProfile); const history = boundHistory(JSON.parse(savedHistory))
    if (!isStorableProfile(profile) || history === null) throw new Error('Invalid state')
    return { profile, history, restored: true }
  } catch {
    try { store.removeItem(PROFILE_STORAGE_KEY); store.removeItem(HISTORY_STORAGE_KEY) } catch { /* unavailable storage */ }
    return { profile: createEmptyProfile(), history: [], restored: false }
  }
}

function createPlanMessage(profile) {
  return profile.language === 'id'
    ? `Buatkan rencana belajar ${profile.subject} selama ${profile.durationDays} hari untuk mencapai tujuan: ${profile.goal}`
    : `Create a ${profile.durationDays}-day ${profile.subject} study plan to achieve: ${profile.goal}`
}

export function useStudyPlanner({ requestChat = defaultRequestChat } = {}) {
  const saved = restoredState(); const profile = reactive(saved.profile); const history = ref(saved.history)
  const profileErrors = ref({}); const adjustmentMessage = ref(''); const adjustmentError = ref(''); const isSubmitting = ref(false); const pendingMessage = ref('')
  const conversationState = ref(saved.restored ? 'restored' : 'empty'); const requestError = ref(''); const lastResponseType = ref(''); let failedRequest = null; let requestSequence = 0
  const hasProfileErrors = computed(() => Object.keys(profileErrors.value).length > 0)
  const persist = () => { const store = storage(); if (!store || !isStorableProfile(profile)) return; try { store.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile)); store.setItem(HISTORY_STORAGE_KEY, JSON.stringify(boundHistory(history.value) ?? [])) } catch { /* quota/privacy must not crash */ } }
  watch(profile, persist, { deep: true }); watch(history, persist, { deep: true })

  async function sendRequest(payload) {
    if (isSubmitting.value) return false
    const sequence = ++requestSequence
    isSubmitting.value = true; pendingMessage.value = payload.message; conversationState.value = 'loading'; requestError.value = ''
    if (payload.mode === 'adjust-study-plan') adjustmentMessage.value = ''
    try {
      const data = await requestChat(payload)
      if (sequence !== requestSequence) return false
      history.value = boundHistory([...history.value, { role: 'user', content: payload.message }, { role: 'assistant', content: data.answer }]) ?? history.value
      lastResponseType.value = typeof data.responseType === 'string' ? data.responseType : payload.mode === 'create-study-plan' ? 'plan-created' : 'focused-answer'
      pendingMessage.value = ''; failedRequest = null; conversationState.value = 'success'; persist()
      return true
    } catch {
      if (sequence !== requestSequence) return false
      pendingMessage.value = ''
      if (payload.mode === 'adjust-study-plan') adjustmentMessage.value = payload.message
      failedRequest = payload; requestError.value = 'We could not complete your request. Please try again.'; conversationState.value = 'error'
      return false
    } finally {
      if (sequence === requestSequence) isSubmitting.value = false
    }
  }

  function submitProfile() {
    if (isSubmitting.value) return Promise.resolve(false)
    profileErrors.value = validateProfile(profile)
    if (hasProfileErrors.value) { conversationState.value = 'empty'; return Promise.resolve(false) }
    const payload = { mode: 'create-study-plan', message: createPlanMessage(profile), profile: copyProfile(profile), history: boundHistory(history.value) ?? [] }
    return sendRequest(payload)
  }

  function submitAdjustment() {
    if (isSubmitting.value) return Promise.resolve(false)
    profileErrors.value = validateProfile(profile)
    if (hasProfileErrors.value) { conversationState.value = 'empty'; return Promise.resolve(false) }
    adjustmentError.value = validateAdjustmentMessage(adjustmentMessage.value)
    if (adjustmentError.value) return Promise.resolve(false)
    const payload = { mode: 'adjust-study-plan', message: adjustmentMessage.value.trim(), profile: copyProfile(profile), history: boundHistory(history.value) ?? [] }
    return sendRequest(payload)
  }

  function retryRequest() {
    if (!failedRequest || isSubmitting.value) return Promise.resolve(false)
    return sendRequest(failedRequest)
  }

  function resetConversation() {
    requestSequence += 1; isSubmitting.value = false; pendingMessage.value = ''; history.value = []; adjustmentMessage.value = ''; adjustmentError.value = ''; requestError.value = ''; lastResponseType.value = ''; failedRequest = null; conversationState.value = 'empty'
  }

  function clearPlan() {
    resetConversation()
    Object.assign(profile, createEmptyProfile())
    profileErrors.value = {}
    const store = storage()
    try { store?.removeItem(PROFILE_STORAGE_KEY); store?.removeItem(HISTORY_STORAGE_KEY) } catch { /* unavailable storage */ }
  }

  return { profile, history, profileErrors, adjustmentMessage, adjustmentError, pendingMessage, isSubmitting, conversationState, requestError, lastResponseType, hasProfileErrors, submitProfile, submitAdjustment, retryRequest, clearPlan }
}
