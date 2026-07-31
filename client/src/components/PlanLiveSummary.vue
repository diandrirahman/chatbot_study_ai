<script setup>
import { computed } from 'vue'

const props = defineProps({ profile: { type: Object, required: true } })
const dayLabels = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' }
const labels = {
  level: { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' },
  style: { practice: 'Hands-on practice', reading: 'Reading and notes', video: 'Video lessons', project: 'Project-based learning', combination: 'A combination' },
  intensity: { relaxed: 'Relaxed', normal: 'Balanced', intensive: 'Intensive' },
}
const estimatedHours = computed(() => {
  const sessions = (Number(props.profile.durationDays) / 7) * props.profile.studyDays.length
  return Math.max(0, sessions * Number(props.profile.dailyMinutes) / 60).toFixed(1).replace('.0', '')
})
</script>

<template>
  <aside class="plan-summary" aria-labelledby="summary-title">
    <header class="summary-header">
      <div><span class="section-kicker">Live plan summary</span><h2 id="summary-title">Your study profile</h2></div>
      <span class="live-indicator"><i></i> Live</span>
    </header>

    <div class="summary-objective">
      <span>Topic</span>
      <strong>{{ profile.subject.trim() || 'Not added yet' }}</strong>
      <p>{{ profile.goal.trim() || 'Your learning goal will appear here as you type.' }}</p>
    </div>

    <dl class="summary-list">
      <div><dt>Level</dt><dd>{{ labels.level[profile.level] }}</dd></div>
      <div><dt>Duration</dt><dd>{{ profile.durationDays }} days</dd></div>
      <div><dt>Daily time</dt><dd>{{ profile.dailyMinutes }} min</dd></div>
      <div><dt>Language</dt><dd>{{ profile.language === 'id' ? 'Bahasa Indonesia' : 'English' }}</dd></div>
      <div class="summary-wide"><dt>Study days</dt><dd class="day-summary"><span v-for="day in profile.studyDays" :key="day">{{ dayLabels[day] }}</span><em v-if="!profile.studyDays.length">None selected</em></dd></div>
      <div class="summary-wide"><dt>Learning style</dt><dd>{{ labels.style[profile.learningStyle] }}</dd></div>
      <div class="summary-wide"><dt>Intensity</dt><dd>{{ labels.intensity[profile.intensity] }}</dd></div>
    </dl>

    <div class="time-estimate">
      <span class="estimate-icon" aria-hidden="true">◷</span>
      <div><span>Estimated learning time</span><strong>~{{ estimatedHours }} hours</strong></div>
    </div>
    <p class="summary-note">Estimate is based on your selected days and daily study time.</p>
  </aside>
</template>
