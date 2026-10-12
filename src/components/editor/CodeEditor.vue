<script setup lang="ts">
import type { FighterId } from '../../config'
import { useDark } from '@vueuse/core'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { codeModels, monaco } from '../../monaco/setup'

const props = defineProps<{ fighter: FighterId }>()

const host = ref<HTMLElement>()
const isDark = useDark({ initialValue: 'dark' })
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
    theme: isDark.value ? 'ja-dark' : 'ja-light',
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

watch(isDark, (dark) => {
  monaco.editor.setTheme(dark ? 'ja-dark' : 'ja-light')
})

onBeforeUnmount(() => {
  editor?.dispose()
  editor = null
})
</script>

<template>
  <div ref="host" class="inset-0 absolute" />
</template>
