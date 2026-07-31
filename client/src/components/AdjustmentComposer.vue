<script setup>
import { computed } from 'vue'
import { getWorkspaceLabels } from '../utils/workspaceLabels.js'
const props = defineProps({ modelValue: { type: String, required: true }, error: { type: String, default: '' }, submitting: { type: Boolean, default: false }, language: { type: String, default: 'en' } })
defineEmits(['update:modelValue', 'submit-adjustment'])
const labels = computed(() => getWorkspaceLabels(props.language))
</script>
<template>
  <form class="composer" @submit.prevent="$emit('submit-adjustment')">
    <label class="sr-only" for="adjustment">{{ labels.adjustmentLabel }}</label>
    <textarea id="adjustment" :value="modelValue" rows="2" maxlength="2000" :placeholder="labels.adjustmentPlaceholder" :class="{ 'input-error': error }" :aria-invalid="Boolean(error)" :aria-describedby="error ? 'adjustment-error' : 'adjustment-note'" :disabled="submitting" @input="$emit('update:modelValue', $event.target.value)"></textarea>
    <button class="send-button" type="submit" :disabled="submitting" :aria-label="labels.sendAdjustment"><span aria-hidden="true">↑</span></button>
  </form>
  <p v-if="error" id="adjustment-error" class="composer-error" role="alert">{{ labels.adjustmentRequired }}</p>
  <p id="adjustment-note" class="composer-note">{{ labels.adjustmentNote }}</p>
</template>
