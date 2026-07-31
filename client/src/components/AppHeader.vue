<script setup>
import { computed } from 'vue'
import { getWorkspaceLabels } from '../utils/workspaceLabels.js'
const props = defineProps({ showClear: { type: Boolean, default: false }, language: { type: String, default: 'en' } })
defineEmits(['clear-plan'])
const labels = computed(() => getWorkspaceLabels(props.language))
</script>

<template>
  <header class="app-header">
    <a class="brand" href="#top" aria-label="StudyMate AI home"><span class="brand-mark" aria-hidden="true">S</span><span>StudyMate <strong>AI</strong></span></a>
    <nav class="header-actions" :aria-label="labels.planActions">
      <button v-if="showClear" class="button button-ghost danger-link" type="button" @click="$emit('clear-plan')">{{ labels.clearPlan }}</button>
    </nav>
  </header>
</template>
