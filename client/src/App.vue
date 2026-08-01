<script setup>
import { computed, onMounted, ref } from 'vue'
import AppHeader from './components/AppHeader.vue'
import AssistantDrawer from './components/AssistantDrawer.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import GenerationProgress from './components/GenerationProgress.vue'
import PlanLiveSummary from './components/PlanLiveSummary.vue'
import StudyPlanWorkspace from './components/StudyPlanWorkspace.vue'
import StudyProfileForm from './components/StudyProfileForm.vue'
import { useStudyPlanner } from './composables/useStudyPlanner.js'
import { useLearningProgress } from './composables/useLearningProgress.js'
import { useBackendReadiness } from './composables/useBackendReadiness.js'
import './styles/app.css'

const backend = useBackendReadiness()
const planner = useStudyPlanner({ waitForBackend: backend.ensureReady })
const learning = useLearningProgress({ waitForBackend: backend.ensureReady })
const assistantOpen = ref(false)
const clearDialogOpen = ref(false)
const editAfterError = ref(false)
const profileState = computed(() => (planner.isSubmitting.value ? 'submitting' : planner.hasProfileErrors.value ? 'invalid' : 'idle'))
const hasPlan = computed(() => Boolean(planner.planMarkdown.value))
const interfaceLanguage = computed(() => hasPlan.value ? planner.profile.language : 'en')
const isInitialLoading = computed(() => planner.conversationState.value === 'loading' && !hasPlan.value)
const isInitialError = computed(() => planner.conversationState.value === 'error' && !hasPlan.value && !editAfterError.value)
const generationState = computed(() => isInitialError.value ? 'error' : backend.status.value === 'warming' ? 'warming' : 'loading')
const showSetup = computed(() => !hasPlan.value && !isInitialLoading.value && !isInitialError.value)
const planAnswer = computed(() => planner.planMarkdown.value)

const syncLearning = async ({ message, responseType, reset = false } = {}) => {
  if (!planAnswer.value) return false
  const latestAnswer = planner.history.value.filter((item) => item.role === 'assistant').at(-1)?.content ?? ''
  const learningPlan = responseType === 'plan-adjustment' && latestAnswer ? `${planAnswer.value}\n\n${latestAnswer}` : planAnswer.value
  return learning.generateSessions(planner.profile, learningPlan, {
    reset: reset || responseType === 'target-change',
    adjustment: message ? { message, answer: latestAnswer } : undefined,
  })
}

const generatePlan = async () => {
  editAfterError.value = false
  if (await planner.submitProfile()) await syncLearning({ responseType: 'plan-created' })
}
const regeneratePlan = async () => {
  if (await planner.submitProfile()) await syncLearning({ responseType: 'plan-created', reset: true })
}
const submitAdjustment = async () => {
  const message = planner.adjustmentMessage.value
  if (!await planner.submitAdjustment()) return false
  if (['plan-adjustment', 'target-change'].includes(planner.lastResponseType.value)) await syncLearning({ message, responseType: planner.lastResponseType.value })
  return true
}
const retryRequest = async () => {
  if (!await planner.retryRequest()) return false
  if (!learning.sessions.value.length || ['plan-adjustment', 'target-change'].includes(planner.lastResponseType.value)) await syncLearning({ responseType: planner.lastResponseType.value })
  return true
}
const prepareAdjustment = (message) => {
  planner.adjustmentMessage.value = message
  assistantOpen.value = true
}
const clearEverything = () => {
  planner.clearPlan()
  learning.clearLearning()
  assistantOpen.value = false
  clearDialogOpen.value = false
  editAfterError.value = true
}

onMounted(() => {
  void backend.warmUp()
  if (hasPlan.value && !learning.sessions.value.length) syncLearning({ responseType: 'plan-created' })
})
</script>

<template>
  <div id="top" class="page-shell">
    <AppHeader :show-clear="hasPlan || Boolean(planner.profile.subject || planner.profile.goal)" :show-regenerate="hasPlan" :regenerating="planner.isSubmitting.value" :language="interfaceLanguage" @regenerate-plan="regeneratePlan" @clear-plan="clearDialogOpen = true" />

    <main v-if="showSetup" class="setup-workspace" aria-label="Build your study profile">
      <StudyProfileForm :profile="planner.profile" :errors="planner.profileErrors.value" :state="profileState" @submit-profile="generatePlan" />
      <PlanLiveSummary :profile="planner.profile" />
    </main>

    <GenerationProgress v-else-if="isInitialLoading || isInitialError" :state="generationState" :language="planner.profile.language" :error-message="planner.requestError.value" @retry="retryRequest" @edit-profile="editAfterError = true" />

    <StudyPlanWorkspace v-else :profile="planner.profile" :plan-markdown="planner.planMarkdown.value" :history="planner.history.value" :sessions="learning.sessions.value" :learning-progress="learning.progress" :current-session="learning.selectedSession.value" :next-session="learning.nextSession.value" :completion-percent="learning.completionPercent.value" :mastery-percent="learning.masteryPercent.value" :completed-count="learning.completedCount.value" :sessions-loading="learning.sessionsLoading.value" :sessions-error="learning.sessionsError.value" :quiz-loading-id="learning.quizLoadingId.value" :quiz-error="learning.quizError.value" :session-status="learning.sessionStatus" @open-assistant="assistantOpen = true" @prepare-adjustment="prepareAdjustment" @select-session="learning.selectSession" @continue-session="learning.selectNextSession" @retry-sessions="syncLearning({ responseType: 'plan-created' })" @toggle-activity="learning.toggleActivity" @load-quiz="learning.ensureQuiz(planner.profile, $event)" @answer-quiz="learning.answerQuestion" @submit-quiz="learning.submitQuiz" @retry-quiz="learning.retryQuiz" />

    <AssistantDrawer :open="assistantOpen" :history="planner.history.value" :pending-message="planner.pendingMessage.value" :model-value="planner.adjustmentMessage.value" :error="planner.adjustmentError.value" :request-error="hasPlan && planner.conversationState.value === 'error' ? planner.requestError.value : ''" :submitting="planner.isSubmitting.value" :preparing="backend.status.value === 'warming'" :language="interfaceLanguage" @close="assistantOpen = false" @update:model-value="planner.adjustmentMessage.value = $event" @submit-adjustment="submitAdjustment" @retry="retryRequest" />
    <ConfirmDialog :open="clearDialogOpen" :language="interfaceLanguage" @cancel="clearDialogOpen = false" @confirm="clearEverything" />
  </div>
</template>
