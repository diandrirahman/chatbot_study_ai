<script setup>
import { onBeforeUnmount, ref } from 'vue'

const props = defineProps({ state: { type: String, required: true }, errorMessage: { type: String, default: '' } })
defineEmits(['retry', 'edit-profile'])
const activeStep = ref(0)
const stages = ['Analysing learning goal', 'Structuring milestones', 'Distributing sessions', 'Preparing study plan']
let timer
if (props.state === 'loading') timer = window.setInterval(() => { activeStep.value = Math.min(stages.length - 1, activeStep.value + 1) }, 900)
onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <main class="generation-shell" aria-live="polite">
    <section v-if="state === 'loading'" class="generation-panel" role="status">
      <div class="generation-mark" aria-hidden="true"><span></span></div>
      <span class="section-kicker">Building your learning path</span>
      <h1>Turning your profile into a practical plan</h1>
      <p>StudyMate is organising your time, priorities, and milestones. This usually takes a moment.</p>
      <ol class="generation-steps">
        <li v-for="(stage, index) in stages" :key="stage" :class="{ active: index === activeStep, complete: index < activeStep }">
          <span>{{ index < activeStep ? '✓' : index + 1 }}</span><strong>{{ stage }}</strong><em>{{ index < activeStep ? 'Complete' : index === activeStep ? 'In progress' : 'Waiting' }}</em>
        </li>
      </ol>
    </section>
    <section v-else class="generation-panel error-panel" role="alert">
      <div class="error-mark" aria-hidden="true">!</div>
      <span class="section-kicker">Plan generation stopped</span>
      <h1>We couldn't create your plan</h1>
      <p>{{ errorMessage || 'Your profile is safe. Try the request again or return to edit your answers.' }}</p>
      <div class="error-actions"><button class="button button-primary" type="button" @click="$emit('retry')">Try again</button><button class="button button-secondary" type="button" @click="$emit('edit-profile')">Edit profile</button></div>
    </section>
  </main>
</template>
