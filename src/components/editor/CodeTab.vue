<script setup lang="ts">
import type { FighterId } from '../../config'
import ActionButton from '@antfu/design/components/Action/ActionButton.vue'
import ActionToggleGroup from '@antfu/design/components/Action/ActionToggleGroup.vue'
import FormSelect from '@antfu/design/components/Form/FormSelect.vue'
import { ref } from 'vue'
import { EXAMPLES } from '../../editor/examples'
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

const exampleId = ref<string>()

function loadExample(id: string | undefined): void {
  if (!id)
    return
  const ex = EXAMPLES.find(e => e.id === id)
  if (!ex)
    return
  codes[fighter.value] = ex.code
  pushConsole('sys', `已加载示例「${ex.name}」到 ${fighter.value}`)
  exampleId.value = undefined
}

/** 把 P1 当前代码保存到选中的预设（内置预设会自动存成副本） */
function saveToPreset(): void {
  const saved = saveCodeToPreset(presets.selectedId, codes.P1)
  if (saved)
    pushConsole('sys', `P1 代码已保存到预设「${saved.name}」`)
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
        placeholder="— 加载示例 —"
        :options="EXAMPLES.map(e => ({ value: e.id, label: e.name }))"
        @update:model-value="loadExample"
      />
      <div class="flex gap-1.5">
        <ActionButton
          v-if="!solo" size="sm" icon="i-ph:floppy-disk" :disabled="fighter !== 'P1'"
          title="把 P1 当前代码保存到选中的预设"
          @click="saveToPreset()"
        >
          存为预设
        </ActionButton>
        <ActionButton variant="primary" @click="gameApi?.run()">
          ▶ 运行
        </ActionButton>
        <ActionButton @click="gameApi?.stop()">
          ■ 停止
        </ActionButton>
        <ActionButton @click="gameApi?.reset()">
          ↺ 重置回合
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
        {{ id.value }}: {{ gameStore.status[id.value as FighterId].text }}
      </div>
    </div>

    <div class="flex-1 min-h-0 relative">
      <CodeEditor :fighter="fighter" />
    </div>

    <ConsolePanel />
  </div>
</template>
