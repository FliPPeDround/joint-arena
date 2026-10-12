<script setup lang="ts">
import { toggleEditorPanel, uiStore } from '../../stores/ui'

function onClick(e: MouseEvent): void {
  toggleEditorPanel()
  // 释放焦点：避免空格/回车误触折叠，也让游戏按键立即生效
  ;(e.currentTarget as HTMLElement).blur()
}
</script>

<template>
  <!-- 工作区左缘的“书脊”把手：覆盖在舞台右缘之上，位置随面板收展与舞台内收同步滑动 -->
  <button
    type="button"
    class="color-muted outline-none border-l border-base bg-base flex flex-col w-6 cursor-pointer pointer-events-auto transition-[right,background-color,color] duration-250 ease-out items-center inset-y-0 justify-center absolute hover:color-base hover:bg-hover focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-inset"
    :class="uiStore.panelOpen ? 'right-120' : 'right-0'"
    :aria-label="uiStore.panelOpen ? '收起工作区' : '展开工作区'"
    :title="uiStore.panelOpen ? '收起工作区' : '展开工作区'"
    @click="onClick"
  >
    <span
      class="panel-toggle-caret i-ph:caret-right-bold text-sm transition-transform duration-200"
      :class="uiStore.panelOpen ? '' : 'rotate-180'"
      aria-hidden="true"
    />
  </button>
</template>
