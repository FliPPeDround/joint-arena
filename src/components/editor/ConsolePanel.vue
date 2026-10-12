<script setup lang="ts">
import type { ConsoleLevel } from '../../stores/game'
import { nextTick, ref, watch } from 'vue'
import { gameStore } from '../../stores/game'

const el = ref<HTMLElement>()

watch(() => gameStore.consoleLines.length, async () => {
  await nextTick()
  if (el.value)
    el.value.scrollTop = el.value.scrollHeight
})

const LEVEL_CLASS: Record<ConsoleLevel, string> = {
  info: 'color-muted',
  warn: 'color-scale-medium',
  error: 'color-scale-critical',
  sys: 'color-scale-low',
}
</script>

<template>
  <div class="border-t border-base">
    <div class="text-micro color-muted px-2.5 py-0.5 border-b border-base bg-secondary">
      控制台
    </div>
    <div ref="el" class="text-mini leading-relaxed font-mono px-2 py-1 bg-sunken h-37.5 overflow-y-auto">
      <div
        v-for="(line, i) in gameStore.consoleLines"
        :key="i"
        class="whitespace-pre-wrap"
        :class="LEVEL_CLASS[line.level]"
      >
        {{ line.fighter ? `[${line.fighter}] ` : '' }}{{ line.text }}
      </div>
    </div>
  </div>
</template>
