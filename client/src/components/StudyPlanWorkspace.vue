<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { renderSafeMarkdown } from '../utils/renderMarkdown.js'
import { getWorkspaceLabels } from '../utils/workspaceLabels.js'
import { hasLearningActivity, resolveWorkspaceMode } from '../utils/workspaceState.js'
import LearningSessionPanel from './LearningSessionPanel.vue'

const props = defineProps({ profile: { type: Object, required: true }, history: { type: Array, required: true }, sessions: { type: Array, default: () => [] }, learningProgress: { type: Object, required: true }, currentSession: { type: Object, default: null }, nextSession: { type: Object, default: null }, completionPercent: { type: Number, default: 0 }, masteryPercent: { type: Number, default: 0 }, completedCount: { type: Number, default: 0 }, sessionsLoading: Boolean, sessionsError: { type: String, default: '' }, quizLoadingId: { type: String, default: null }, quizError: { type: String, default: '' }, sessionStatus: { type: Function, required: true } })
const emit = defineEmits(['open-assistant', 'prepare-adjustment', 'select-session', 'continue-session', 'retry-sessions', 'toggle-activity', 'load-quiz', 'answer-quiz', 'submit-quiz', 'retry-quiz'])
const progressSummary = ref(null)
const requestedMode = ref(null)

const language = computed(() => props.profile.language === 'id' ? 'id' : 'en')
const labels = computed(() => getWorkspaceLabels(language.value))
const assistants = computed(() => props.history.filter((item) => item.role === 'assistant'))
const planAnswer = computed(() => assistants.value[0]?.content ?? '')
const latestUpdate = computed(() => assistants.value.length > 1 ? assistants.value.at(-1)?.content : '')
const hasStartedLearning = computed(() => hasLearningActivity(props.sessions, props.learningProgress))
const workspaceMode = computed(() => resolveWorkspaceMode(requestedMode.value, hasStartedLearning.value))
const milestones = computed(() => {
  const structured = [...new Set(props.sessions.map((session) => session.milestone).filter(Boolean))]
  if (structured.length) return structured.slice(0, 6)
  const milestoneItems = [...planAnswer.value.matchAll(/^\s*[-*]\s+\*\*(Milestone\s+\d+[^*]*)\*\*/gim)].map((match) => match[1].replace(/:$/, '').trim())
  if (milestoneItems.length) return milestoneItems.slice(0, 4)
  const headings = [...planAnswer.value.matchAll(/^#{2,4}\s+(.+)$/gm)].map((match) => match[1].replace(/[*_`]/g, '').trim())
  return [...new Set(headings)].filter((heading) => !/ringkasan|summary|strategi|strategy|tips|referensi|reference/i.test(heading)).slice(0, 4)
})
const visibleMilestones = computed(() => milestones.value.length ? milestones.value : labels.value.defaultMilestones)
const milestoneComplete = (milestone) => {
  const related = props.sessions.filter((session) => session.milestone === milestone)
  return related.length > 0 && related.every((session) => ['completed', 'needs-review'].includes(props.sessionStatus(session.id)))
}
const schedule = computed(() => props.profile.studyDays.map((day) => labels.value.days[day] ?? day))
const totalHours = computed(() => Math.max(0, (props.profile.durationDays / 7) * props.profile.studyDays.length * props.profile.dailyMinutes / 60).toFixed(1).replace('.0', ''))

const focusSessionHeading = async () => { await nextTick(); document.getElementById('session-detail-title')?.focus() }
const openSession = async (id) => { requestedMode.value = 'session'; emit('select-session', id); await focusSessionHeading() }
const continueSession = () => { requestedMode.value = 'session'; emit('continue-session') }
const showOverview = async () => { requestedMode.value = 'overview'; await nextTick(); document.getElementById('overview-title')?.focus() }
const viewProgress = async () => { progressSummary.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }); await nextTick(); progressSummary.value?.focus() }
watch(() => props.currentSession?.id, (currentId, previousId) => { if (workspaceMode.value === 'session' && currentId && previousId && currentId !== previousId) focusSessionHeading() })
watch(() => props.sessions, () => { requestedMode.value = null })
</script>

<template>
  <main class="plan-workspace" aria-labelledby="plan-title">
    <header class="plan-header">
      <div class="plan-title-block">
        <span class="section-kicker">{{ labels.activePlan }}</span>
        <h1 id="plan-title">{{ profile.subject }}</h1>
        <p>{{ profile.goal }}</p>
      </div>
      <button class="button button-assistant" type="button" @click="$emit('open-assistant')"><span aria-hidden="true">✦</span> {{ labels.askStudyMate }}</button>
    </header>

    <section ref="progressSummary" class="progress-band" tabindex="-1" :aria-label="labels.progressAria">
      <div class="progress-copy"><span>{{ labels.overallProgress }}</span><strong>{{ labels.percentComplete(completionPercent) }}</strong></div>
      <div class="progress-track" role="progressbar" :aria-label="labels.progressAria" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="completionPercent"><span :style="{ width: `${completionPercent}%` }"></span></div>
      <dl><div><dt>{{ labels.completed }}</dt><dd>{{ labels.sessionsCount(completedCount, sessions.length) }}</dd></div><div><dt>{{ labels.mastery }}</dt><dd>{{ masteryPercent }}%</dd></div><div><dt>{{ labels.studyTime }}</dt><dd>{{ labels.hours(totalHours) }}</dd></div><div><dt>{{ labels.schedule }}</dt><dd>{{ schedule.join(', ') }}</dd></div></dl>
    </section>

    <div v-if="workspaceMode === 'overview'" class="workspace-mode-heading">
      <div><span class="section-kicker">{{ labels.overview }}</span><h2 id="overview-title" tabindex="-1">{{ labels.overviewTitle }}</h2></div>
    </div>

    <div v-else class="session-mode-toolbar"><span class="section-kicker">{{ labels.sessionFocus }}</span><button class="button button-secondary" type="button" @click="showOverview">{{ labels.viewOverview }}</button></div>

    <div class="plan-dashboard">
      <div class="plan-main-column">
        <section v-if="!currentSession" class="session-generation-state" :class="{ error: sessionsError }" aria-live="polite"><span class="section-kicker">{{ labels.learningSessions }}</span><h2>{{ sessionsLoading ? labels.preparingSessions : sessionsError ? labels.sessionsUnavailable : labels.preparingSessions }}</h2><p>{{ sessionsError === 'rate-limited' ? labels.rateLimited : labels.planSafe }}</p><button v-if="sessionsError" class="button button-secondary" type="button" @click="$emit('retry-sessions')">{{ labels.tryAgain }}</button></section>

        <template v-else-if="workspaceMode === 'overview'">
          <section class="overview-intro" aria-labelledby="overview-session-title"><div><span class="section-kicker">{{ labels.selectedSession }}</span><h3 id="overview-session-title">{{ currentSession.title }}</h3><p>{{ labels.overviewIntro }}</p></div><button class="button button-primary" type="button" @click="openSession(currentSession.id)">{{ labels.startLearning }} →</button></section>

          <section v-if="latestUpdate" class="latest-update" aria-labelledby="update-title"><header><div><span class="section-kicker">{{ labels.latestAdjustment }}</span><h2 id="update-title">{{ labels.planUpdate }}</h2></div><button class="text-button" type="button" @click="$emit('open-assistant')">{{ labels.viewConversation }}</button></header><div class="markdown-content" v-html="renderSafeMarkdown(latestUpdate)"></div></section>

          <section class="plan-document" aria-labelledby="document-title"><header><div><span class="section-kicker">{{ labels.completePlan }}</span><h2 id="document-title">{{ labels.documentTitle }}</h2></div><span class="document-meta">{{ labels.generatedFor(labels.levels[profile.level] ?? profile.level) }}</span></header><div class="markdown-content plan-markdown" v-html="renderSafeMarkdown(planAnswer)"></div></section>
        </template>

        <template v-else>
          <LearningSessionPanel :session="currentSession" :next-session="nextSession" :language="language" :progress="learningProgress[currentSession.id]" :status="sessionStatus(currentSession.id)" :quiz-loading="quizLoadingId === currentSession.id" :quiz-error="quizError" @toggle-activity="$emit('toggle-activity', currentSession.id, $event)" @load-quiz="$emit('load-quiz', currentSession)" @answer="(questionId, optionId) => $emit('answer-quiz', currentSession.id, questionId, optionId)" @submit-quiz="$emit('submit-quiz', currentSession.id)" @retry-quiz="$emit('retry-quiz', currentSession.id)" @continue-session="continueSession" @view-progress="viewProgress" />

          <section v-if="latestUpdate" class="latest-update" aria-labelledby="update-title"><header><div><span class="section-kicker">{{ labels.latestAdjustment }}</span><h2 id="update-title">{{ labels.planUpdate }}</h2></div><button class="text-button" type="button" @click="$emit('open-assistant')">{{ labels.viewConversation }}</button></header><div class="markdown-content" v-html="renderSafeMarkdown(latestUpdate)"></div></section>

          <details class="plan-reference"><summary>{{ labels.openDocument }}</summary><section class="plan-document" aria-labelledby="reference-document-title"><header><div><span class="section-kicker">{{ labels.completePlan }}</span><h2 id="reference-document-title">{{ labels.documentTitle }}</h2></div><span class="document-meta">{{ labels.generatedFor(labels.levels[profile.level] ?? profile.level) }}</span></header><div class="markdown-content plan-markdown" v-html="renderSafeMarkdown(planAnswer)"></div></section></details>
        </template>
      </div>

      <aside class="plan-side-column">
        <section class="side-section" aria-labelledby="curriculum-title"><div class="side-heading"><div><h2 id="curriculum-title">{{ labels.curriculum }}</h2><p>{{ labels.curriculumHint }}</p></div><span>{{ labels.minutesPerSession(profile.dailyMinutes) }}</span></div><ol class="upcoming-list"><li v-for="session in sessions" :key="session.id" :class="{ active: currentSession?.id === session.id }"><button type="button" @click="openSession(session.id)"><span>{{ String(session.order).padStart(2, '0') }}</span><div><strong>{{ session.title }}</strong><small>{{ labels.days[session.studyDay] ?? session.studyDay }} · {{ labels.statuses[sessionStatus(session.id)] }}</small></div></button></li></ol></section>

        <section class="side-section" aria-labelledby="milestone-title"><div class="side-heading"><h2 id="milestone-title">{{ labels.milestones }}</h2><span>{{ labels.sessionsComplete(completedCount) }}</span></div><ul class="milestone-list"><li v-for="(milestone, index) in visibleMilestones" :key="milestone" :class="{ complete: milestoneComplete(milestone) }"><span>{{ milestoneComplete(milestone) ? '✓' : index + 1 }}</span><p>{{ milestone }}</p></li></ul></section>

        <section class="assistant-invite"><span aria-hidden="true">✦</span><div><strong>{{ labels.assistantTitle }}</strong><p>{{ labels.assistantDescription }}</p><button class="button button-secondary assistant-cta" type="button" @click="$emit('open-assistant')">{{ labels.askStudyMate }}</button></div></section>
      </aside>
    </div>

    <button class="floating-assistant-button" type="button" :aria-label="labels.askStudyMate" @click="$emit('open-assistant')"><span aria-hidden="true">✦</span><span class="floating-assistant-label">{{ labels.askStudyMate }}</span></button>
  </main>
</template>
