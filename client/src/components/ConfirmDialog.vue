<script setup>
import { nextTick, ref, watch } from 'vue'
import { computed } from 'vue'
import { getWorkspaceLabels } from '../utils/workspaceLabels.js'
const props = defineProps({ open: Boolean, language: { type: String, default: 'en' } })
const emit = defineEmits(['cancel', 'confirm'])
const cancelButton = ref(null)
const labels = computed(() => getWorkspaceLabels(props.language))
watch(() => props.open, async (open) => { if (open) { await nextTick(); cancelButton.value?.focus() } })
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-layer" @keydown.esc="$emit('cancel')">
      <button class="dialog-scrim" type="button" :aria-label="labels.cancelClear" @click="$emit('cancel')"></button>
      <section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="clear-title" aria-describedby="clear-description">
        <div class="danger-icon" aria-hidden="true">!</div><h2 id="clear-title">{{ labels.clearTitle }}</h2><p id="clear-description">{{ labels.clearDescription }}</p>
        <div class="dialog-actions"><button ref="cancelButton" class="button button-secondary" type="button" @click="$emit('cancel')">{{ labels.keepPlan }}</button><button class="button button-danger" type="button" @click="$emit('confirm')">{{ labels.clearEverything }}</button></div>
      </section>
    </div>
  </Teleport>
</template>
