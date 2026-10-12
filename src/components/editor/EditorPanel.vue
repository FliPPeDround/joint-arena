<script setup lang="ts">
import LayoutTabs from '@antfu/design/components/Layout/LayoutTabs.vue'
import { ref } from 'vue'
import { uiStore } from '../../stores/ui'
import CodeTab from './CodeTab.vue'
import DocsTab from './DocsTab.vue'
import SettingsTab from './SettingsTab.vue'
import TextureTab from './TextureTab.vue'

const tab = ref('code')

const tabs = [
  { value: 'code', label: '代码' },
  { value: 'docs', label: 'SDK 文档' },
  { value: 'tex', label: '纹理' },
  { value: 'settings', label: '设置' },
]
</script>

<template>
  <!-- id 保留：InputSystem 依赖 #editor-panel 判断按键来自编辑器还是游戏。
       折叠时 aside 宽度归零、内容保持 w-120 只做裁剪（Monaco 无需重排）；
       左缘边界由 PanelToggle 书脊把手承担 -->
  <aside
    id="editor-panel"
    class="bg-base flex shrink-0 flex-col h-full transition-[width] duration-250 ease-out of-hidden"
    :class="uiStore.panelOpen ? 'w-120' : 'w-0'"
  >
    <div class="flex flex-1 flex-col min-h-0 w-120">
      <LayoutTabs v-model="tab" :tabs="tabs" />
      <div class="flex flex-1 flex-col min-h-0">
        <CodeTab v-show="tab === 'code'" />
        <DocsTab v-show="tab === 'docs'" />
        <TextureTab v-show="tab === 'tex'" />
        <SettingsTab v-show="tab === 'settings'" />
      </div>
    </div>
  </aside>
</template>
