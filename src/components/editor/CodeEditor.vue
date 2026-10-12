<script setup lang="ts">
import type { FighterId } from '../../config'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { codeModels, monaco } from '../../monaco/setup'

const props = defineProps<{ fighter: FighterId }>()

const host = ref<HTMLElement>()
let editor: monaco.editor.IStandaloneCodeEditor | null = null

onMounted(() => {
  editor = monaco.editor.create(host.value!, {
    model: codeModels[props.fighter].model,
    automaticLayout: true,
    fontSize: 13,
    fontFamily: 'DM Mono, ui-monospace, Menlo, Consolas, monospace',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    padding: { top: 8 },
    renderLineHighlight: 'all',
    smoothScrolling: true,
    theme: 'ja-dark',
  })
})

watch(() => props.fighter, (next, prev) => {
  if (!editor)
    return
  codeModels[prev].viewState = editor.saveViewState()
  editor.setModel(codeModels[next].model)
  const state = codeModels[next].viewState
  if (state)
    editor.restoreViewState(state)
})

onBeforeUnmount(() => {
  editor?.dispose()
  editor = null
})
</script>

<template>
  <div ref="host" class="inset-0 absolute" />
</template>
