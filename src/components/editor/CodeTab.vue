<script setup lang="ts">
import type { FighterId } from '../../config'
import ActionButton from '@antfu/design/components/Action/ActionButton.vue'
import ActionToggleGroup from '@antfu/design/components/Action/ActionToggleGroup.vue'
import FormSelect from '@antfu/design/components/Form/FormSelect.vue'
import { computed, ref } from 'vue'
import { EXAMPLE_IDS, exampleCode, exampleName } from '../../editor/examples'
import { msg, t } from '../../i18n'
import { codes, gameApi, gameStore, pushConsole } from '../../stores/game'
import { presets, saveCodeToPreset } from '../../stores/presets'
import CodeEditor from './CodeEditor.vue'
import ConsolePanel from './ConsolePanel.vue'

withDefaults(defineProps<{ /** 单人模式（编辑页）：固定 P1，隐藏角色切换 */ solo?: boolean }>(), { solo: false })

const fighter = ref<FighterId>('P1')

const fighterOptions = [
  { value: 'P1', label: 'P1' },
  { value: 'P2', label: 'P2' },
]

/** 下拉项随语言重算（示例名是目录里的标签） */
const exampleOptions = computed(() => EXAMPLE_IDS.map(id => ({ value: id, label: exampleName(id) })))

const exampleId = ref<string>()

function loadExample(id: string | undefined): void {
  if (!id)
    return
  const picked = EXAMPLE_IDS.find(e => e === id)
  if (!picked)
    return
  codes[fighter.value] = exampleCode(picked)
  pushConsole('sys', msg('console.loadedExample', { name: exampleName(picked), fighter: fighter.value }))
  exampleId.value = undefined
}

/** 把 P1 当前代码保存到选中的预设（内置预设会自动存成副本） */
function saveToPreset(): void {
  const saved = saveCodeToPreset(presets.selectedId, codes.P1)
  if (saved)
    pushConsole('sys', msg('console.presetSavedTo', { name: saved.name }))
}
</script>

<template>
  <div class="flex flex-1 flex-col min-h-0">
    <div class="p-2 border-b border-base flex flex-wrap gap-2 items-center">
      <ActionToggleGroup v-if="!solo" v-model="fighter" :options="fighterOptions" />
      <span v-else class="text-sm font-bold px-1" :style="{ color: 'var(--ja-p1)' }">P1</span>
      <FormSelect
        v-model="exampleId"
        class="min-w-30 flex-1!"
        :placeholder="t('editor.loadExample')"
        :options="exampleOptions"
        @update:model-value="loadExample"
      />
      <div class="flex gap-1.5">
        <ActionButton
          v-if="!solo" size="sm" icon="i-ph:floppy-disk" :disabled="fighter !== 'P1'"
          :title="t('editor.saveToPresetTip')" @click="saveToPreset()"
        >
          {{ t('editor.saveAsPreset') }}
        </ActionButton>
        <ActionButton variant="primary" @click="gameApi?.run()">
          {{ t('editor.run') }}
        </ActionButton>
        <ActionButton @click="gameApi?.stop()">
          {{ t('editor.stop') }}
        </ActionButton>
        <ActionButton @click="gameApi?.reset()">
          {{ t('editor.resetRound') }}
        </ActionButton>
      </div>
    </div>

    <div class="border-b border-base">
      <div
        v-for="id in (solo ? fighterOptions.slice(0, 1) : fighterOptions)"
        :key="id.value"
        class="text-mini px-2.5 py-0.5"
        :class="gameStore.status[id.value as FighterId].error ? 'color-scale-critical' : 'color-muted'"
      >
        {{ id.value }}: {{ t(gameStore.status[id.value as FighterId].key) }}
      </div>
    </div>

    <div class="flex-1 min-h-0 relative">
      <CodeEditor :fighter="fighter" />
    </div>

    <ConsolePanel />
  </div>
</template>
