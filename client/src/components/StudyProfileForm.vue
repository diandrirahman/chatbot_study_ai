<script setup>
import { computed, ref, watch } from 'vue'
import { validateProfileStep } from '../utils/studyProfile.js'

const props = defineProps({
  profile: { type: Object, required: true },
  errors: { type: Object, required: true },
  state: { type: String, default: 'idle' },
})
const emit = defineEmits(['submit-profile', 'step-change'])

const currentStep = ref(1)
const localErrors = ref({})
const studyDays = [
  ['monday', 'Mon'], ['tuesday', 'Tue'], ['wednesday', 'Wed'], ['thursday', 'Thu'],
  ['friday', 'Fri'], ['saturday', 'Sat'], ['sunday', 'Sun'],
]
const displayedErrors = computed(() => ({ ...props.errors, ...localErrors.value }))
const stepCopy = {
  1: { eyebrow: 'Learning objective', title: 'What do you want to achieve?', description: 'Define a clear outcome so your plan stays focused and relevant.' },
  2: { eyebrow: 'Availability', title: 'Shape the plan around your week', description: 'Choose a pace you can realistically maintain.' },
  3: { eyebrow: 'Preferences', title: 'Make the plan work for you', description: 'Select how you learn best, then review your profile.' },
}

const goToStep = (step) => {
  currentStep.value = step
  localErrors.value = {}
  emit('step-change', step)
}

const continueStep = () => {
  localErrors.value = validateProfileStep(props.profile, currentStep.value)
  if (Object.keys(localErrors.value).length) return
  goToStep(Math.min(3, currentStep.value + 1))
}

const submit = () => {
  localErrors.value = validateProfileStep(props.profile, 3)
  if (Object.keys(localErrors.value).length) return
  emit('submit-profile')
}

watch(
  () => ({ ...props.profile, studyDays: [...props.profile.studyDays] }),
  () => { localErrors.value = {} },
  { deep: true },
)
</script>

<template>
  <section class="setup-form" aria-labelledby="setup-title">
    <nav class="setup-stepper" aria-label="Study profile progress">
      <button
        v-for="step in 3"
        :key="step"
        class="stepper-item"
        :class="{ active: currentStep === step, complete: currentStep > step }"
        type="button"
        :aria-current="currentStep === step ? 'step' : undefined"
        :disabled="step > currentStep"
        @click="step < currentStep && goToStep(step)"
      >
        <span class="step-number">{{ currentStep > step ? '✓' : step }}</span>
        <span class="step-label">{{ ['Objective', 'Availability', 'Preferences'][step - 1] }}</span>
      </button>
    </nav>

    <form novalidate @submit.prevent="currentStep === 3 ? submit() : continueStep()">
      <header class="setup-heading">
        <span class="section-kicker">Step {{ currentStep }} of 3 · {{ stepCopy[currentStep].eyebrow }}</span>
        <h1 id="setup-title">{{ stepCopy[currentStep].title }}</h1>
        <p>{{ stepCopy[currentStep].description }}</p>
      </header>

      <div v-if="currentStep === 1" class="step-fields">
        <div class="field-group">
          <label for="subject">Topic</label>
          <input id="subject" v-model="profile.subject" maxlength="100" placeholder="e.g. Organic chemistry" :class="{ 'input-error': displayedErrors.subject }" :aria-invalid="Boolean(displayedErrors.subject)" :aria-describedby="displayedErrors.subject ? 'subject-error' : 'subject-hint'" />
          <span id="subject-hint" class="field-hint">The subject or skill you want to study.</span>
          <span v-if="displayedErrors.subject" id="subject-error" class="field-error" role="alert">{{ displayedErrors.subject }}</span>
        </div>
        <div class="field-group">
          <label for="goal">Learning goal</label>
          <textarea id="goal" v-model="profile.goal" rows="4" maxlength="500" placeholder="e.g. Understand reaction mechanisms and solve practice problems" :class="{ 'input-error': displayedErrors.goal }" :aria-invalid="Boolean(displayedErrors.goal)" :aria-describedby="displayedErrors.goal ? 'goal-error' : 'goal-hint'"></textarea>
          <span id="goal-hint" class="field-hint">Describe the outcome you want, not only the subject.</span>
          <span v-if="displayedErrors.goal" id="goal-error" class="field-error" role="alert">{{ displayedErrors.goal }}</span>
        </div>
        <div class="field-grid">
          <div class="field-group"><label for="level">Current level</label><select id="level" v-model="profile.level"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></div>
          <div class="field-group"><label for="language">Plan language</label><select id="language" v-model="profile.language"><option value="id">Bahasa Indonesia</option><option value="en">English</option></select></div>
        </div>
      </div>

      <div v-else-if="currentStep === 2" class="step-fields">
        <div class="field-grid">
          <div class="field-group"><label for="duration">Target duration</label><div class="input-suffix"><input id="duration" v-model.number="profile.durationDays" type="number" min="1" max="365" :class="{ 'input-error': displayedErrors.durationDays }" :aria-invalid="Boolean(displayedErrors.durationDays)" :aria-describedby="displayedErrors.durationDays ? 'duration-error' : undefined" /><span>days</span></div><span v-if="displayedErrors.durationDays" id="duration-error" class="field-error" role="alert">{{ displayedErrors.durationDays }}</span></div>
          <div class="field-group"><label for="daily-time">Daily study time</label><div class="input-suffix"><input id="daily-time" v-model.number="profile.dailyMinutes" type="number" min="15" max="480" :class="{ 'input-error': displayedErrors.dailyMinutes }" :aria-invalid="Boolean(displayedErrors.dailyMinutes)" :aria-describedby="displayedErrors.dailyMinutes ? 'daily-time-error' : undefined" /><span>min</span></div><span v-if="displayedErrors.dailyMinutes" id="daily-time-error" class="field-error" role="alert">{{ displayedErrors.dailyMinutes }}</span></div>
        </div>
        <fieldset class="field-group days-fieldset">
          <legend>Study days</legend>
          <p class="field-intro">Select every day that can hold a study session.</p>
          <div class="day-picker">
            <label v-for="([value, label]) in studyDays" :key="value" class="day-option"><input v-model="profile.studyDays" :value="value" type="checkbox" /><span>{{ label }}</span></label>
          </div>
          <span v-if="displayedErrors.studyDays" class="field-error" role="alert">{{ displayedErrors.studyDays }}</span>
        </fieldset>
      </div>

      <div v-else class="step-fields">
        <div class="field-group"><label for="style">How do you learn best?</label><select id="style" v-model="profile.learningStyle"><option value="practice">Hands-on practice</option><option value="reading">Reading and notes</option><option value="video">Video lessons</option><option value="project">Project-based learning</option><option value="combination">A combination</option></select></div>
        <fieldset class="field-group intensity-fieldset">
          <legend>Preferred intensity</legend>
          <div class="segmented-control">
            <label><input v-model="profile.intensity" value="relaxed" type="radio" name="intensity" /><span><b>Relaxed</b><small>More review</small></span></label>
            <label><input v-model="profile.intensity" value="normal" type="radio" name="intensity" /><span><b>Balanced</b><small>Steady pace</small></span></label>
            <label><input v-model="profile.intensity" value="intensive" type="radio" name="intensity" /><span><b>Intensive</b><small>Faster pace</small></span></label>
          </div>
        </fieldset>
        <div class="final-check"><span aria-hidden="true">✓</span><div><strong>Your profile is ready</strong><p>Review the summary before generating. You can still go back and edit any answer.</p></div></div>
      </div>

      <footer class="step-actions">
        <button v-if="currentStep > 1" class="button button-secondary" type="button" @click="goToStep(currentStep - 1)">Back</button>
        <span v-else></span>
        <button v-if="currentStep < 3" class="button button-primary" type="submit">Continue <span aria-hidden="true">→</span></button>
        <button v-else class="button button-primary" type="submit" :disabled="state === 'submitting'">{{ state === 'submitting' ? 'Creating plan…' : 'Generate study plan' }}</button>
      </footer>
    </form>
  </section>
</template>
