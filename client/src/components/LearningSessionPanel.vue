<script setup>
import { computed } from 'vue'
import { normalizeStudyNotation } from '../utils/renderMarkdown.js'
import { getWorkspaceLabels } from '../utils/workspaceLabels.js'

const props = defineProps({ session: { type: Object, required: true }, progress: { type: Object, required: true }, status: { type: String, required: true }, nextSession: { type: Object, default: null }, language: { type: String, default: 'en' }, quizLoading: Boolean, quizError: { type: String, default: '' } })
defineEmits(['toggle-activity', 'load-quiz', 'answer', 'submit-quiz', 'retry-quiz', 'continue-session', 'view-progress'])
const answeredCount = computed(() => Object.keys(props.progress.answers ?? {}).length)
const latestScore = computed(() => props.progress.attempts?.at(-1)?.score)
const safeUrl = (value) => { try { const url = new URL(value); return ['http:','https:'].includes(url.protocol) ? url.href : null } catch { return null } }
const text = (value) => normalizeStudyNotation(value)
const labels = computed(() => getWorkspaceLabels(props.language))
const quizErrorMessage = computed(() => props.quizError === 'quiz-incomplete' ? labels.value.answerAll : props.quizError === 'rate-limited' ? labels.value.rateLimited : labels.value.quizLoadError)
</script>

<template>
  <section class="learning-session-panel" aria-labelledby="session-detail-title">
    <header class="session-detail-header">
      <div><span class="section-kicker">{{ labels.session }} {{ session.order }} · {{ labels.minutes(session.durationMinutes) }}</span><h2 id="session-detail-title" tabindex="-1">{{ text(session.title) }}</h2><p>{{ text(session.objective) }}</p></div>
      <span class="session-status" :class="`status-${status}`">{{ labels.statuses[status] }}</span>
    </header>

    <div class="activity-checklist" :aria-label="labels.activities">
      <label v-for="activity in session.activities" :key="activity.id" class="activity-item">
        <input type="checkbox" :checked="progress[`${activity.type}Completed`]" @change="$emit('toggle-activity', activity.type)" />
        <span class="activity-check" aria-hidden="true">{{ progress[`${activity.type}Completed`] ? '✓' : '' }}</span>
        <span><strong>{{ text(activity.title) }}</strong><small>{{ text(activity.description) }}</small></span>
      </label>
    </div>

    <section class="quiz-section" aria-labelledby="quiz-title">
      <header><div><span class="section-kicker">{{ labels.knowledgeCheck }}</span><h3 id="quiz-title">{{ labels.quizTitle }}</h3></div><span v-if="progress.quiz" class="quiz-count">{{ labels.answered(answeredCount) }}</span></header>
      <div v-if="!progress.quiz" class="quiz-empty">
        <p>{{ labels.quizDescription }}</p>
        <button class="button button-primary" type="button" :disabled="quizLoading" @click="$emit('load-quiz')">{{ quizLoading ? labels.preparingQuiz : labels.startQuiz }}</button>
      </div>
      <form v-else @submit.prevent="$emit('submit-quiz')">
        <fieldset v-for="(question, index) in progress.quiz.questions" :key="question.id" class="quiz-question">
          <legend><span>{{ index + 1 }}</span>{{ text(question.prompt) }}</legend>
          <label v-for="option in question.options" :key="option.id" class="quiz-option" :class="{ selected: progress.answers[question.id] === option.id, correct: progress.showResult && option.id === question.correctOptionId, incorrect: progress.showResult && progress.answers[question.id] === option.id && option.id !== question.correctOptionId }">
            <input type="radio" :name="question.id" :value="option.id" :checked="progress.answers[question.id] === option.id" :disabled="progress.showResult" @change="$emit('answer', question.id, option.id)" />
            <span>{{ option.id.toUpperCase() }}</span><p>{{ text(option.text) }}</p>
          </label>
          <div v-if="progress.showResult" class="quiz-explanation"><strong>{{ progress.answers[question.id] === question.correctOptionId ? labels.correct : labels.reviewAnswer }}</strong><p>{{ text(question.explanation) }}</p></div>
        </fieldset>
        <p v-if="quizError" class="quiz-error" role="alert">{{ quizErrorMessage }}</p>
        <div v-if="progress.showResult" class="quiz-result" role="status"><div><span>{{ labels.latestScore }}</span><strong>{{ latestScore }}%</strong></div><div><span>{{ labels.bestScore }}</span><strong>{{ progress.bestScore }}%</strong></div><p>{{ progress.bestScore >= 70 ? labels.masteryReached : labels.reviewRecommended }}</p></div>
        <div class="quiz-actions">
          <button v-if="!progress.showResult" class="button button-primary" type="submit">{{ labels.submitAnswers }}</button>
          <template v-else>
            <button v-if="nextSession" class="button button-primary" type="button" @click="$emit('continue-session')">{{ labels.continueSession }} →</button>
            <button v-else class="button button-primary" type="button" @click="$emit('view-progress')">{{ labels.progressSummary }}</button>
            <button class="button button-secondary" type="button" @click="$emit('retry-quiz')">{{ labels.retryQuiz }}</button>
          </template>
        </div>
        <div v-if="progress.showResult && progress.quiz.references?.length" class="quiz-references"><h4>{{ labels.references }}</h4><ul><li v-for="reference in progress.quiz.references" :key="reference.title"><a v-if="safeUrl(reference.url)" :href="safeUrl(reference.url)" target="_blank" rel="noopener noreferrer">{{ text(reference.title) }}</a><span v-else>{{ text(reference.title) }}</span></li></ul></div>
      </form>
      <div v-if="quizError && !progress.quiz" class="quiz-load-error" role="alert"><p>{{ quizErrorMessage }}</p><button class="button button-secondary" type="button" :disabled="quizLoading" @click="$emit('load-quiz')">{{ labels.tryAgain }}</button></div>
    </section>
  </section>
</template>
