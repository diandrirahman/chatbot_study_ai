<script setup>
import { nextTick, ref, watch } from 'vue'
import { computed } from 'vue'
import AdjustmentComposer from './AdjustmentComposer.vue'
import { renderSafeMarkdown } from '../utils/renderMarkdown.js'
import { getWorkspaceLabels } from '../utils/workspaceLabels.js'

const props = defineProps({ open: Boolean, history: { type: Array, required: true }, modelValue: { type: String, required: true }, error: { type: String, default: '' }, requestError: { type: String, default: '' }, submitting: Boolean, preparing: Boolean, language: { type: String, default: 'en' } })
const emit = defineEmits(['close', 'update:modelValue', 'submit-adjustment', 'retry'])
const closeButton = ref(null)
const messageList = ref(null)
const adjustmentHistory = () => props.history.slice(2)
const labels = computed(() => getWorkspaceLabels(props.language))

watch(() => props.open, async (open) => {
  if (!open) return
  await nextTick()
  closeButton.value?.focus()
  if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="drawer-layer" @keydown.esc="$emit('close')">
      <button class="drawer-scrim" type="button" :aria-label="labels.closeAssistant" @click="$emit('close')"></button>
      <aside class="assistant-drawer" role="dialog" aria-modal="true" aria-labelledby="assistant-title">
        <header class="drawer-header"><div><span class="section-kicker">{{ labels.assistantKicker }}</span><h2 id="assistant-title">{{ labels.askStudyMate }}</h2></div><button ref="closeButton" class="icon-button" type="button" :aria-label="labels.closeAssistant" @click="$emit('close')">×</button></header>
        <div ref="messageList" class="drawer-messages" aria-live="polite">
          <div v-if="!adjustmentHistory().length" class="drawer-empty"><span aria-hidden="true">✦</span><h3>{{ labels.assistantEmptyTitle }}</h3><p>{{ labels.assistantEmptyDescription }}</p></div>
          <article v-for="(message, index) in adjustmentHistory()" :key="`${message.role}-${index}`" class="drawer-message" :class="`drawer-${message.role}`"><strong>{{ message.role === 'assistant' ? 'StudyMate' : labels.you }}</strong><div v-if="message.role === 'assistant'" class="markdown-content" v-html="renderSafeMarkdown(message.content)"></div><p v-else>{{ message.content }}</p></article>
          <article v-if="submitting" class="drawer-message drawer-assistant" role="status"><strong>StudyMate</strong><span v-if="preparing" class="backend-preparing">{{ labels.preparingBackend }}</span><span v-else class="typing-indicator"><i></i><i></i><i></i><span class="sr-only">{{ labels.responding }}</span></span></article>
          <div v-if="requestError" class="drawer-error" role="alert"><p>{{ labels.requestFailed }}</p><button class="button button-secondary" type="button" :disabled="submitting" @click="$emit('retry')">{{ labels.tryAgain }}</button></div>
        </div>
        <footer class="drawer-composer"><AdjustmentComposer :model-value="modelValue" :error="error" :submitting="submitting" :language="language" @update:model-value="$emit('update:modelValue', $event)" @submit-adjustment="$emit('submit-adjustment')" /></footer>
      </aside>
    </div>
  </Teleport>
</template>
