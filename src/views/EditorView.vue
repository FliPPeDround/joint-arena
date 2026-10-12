<script setup lang="ts">
import ActionButton from '@antfu/design/components/Action/ActionButton.vue'
import FormTextInput from '@antfu/design/components/Form/FormTextInput.vue'
import LayoutTabs from '@antfu/design/components/Layout/LayoutTabs.vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CodeTab from '../components/editor/CodeTab.vue'
import DocsTab from '../components/editor/DocsTab.vue'
import PanelToggle from '../components/editor/PanelToggle.vue'
import SettingsTab from '../components/editor/SettingsTab.vue'
import TextureTab from '../components/editor/TextureTab.vue'
import { msg, t } from '../i18n'
import { codes, gameApi, gameStore, pushConsole } from '../stores/game'
import { getPreset, saveCodeToPreset } from '../stores/presets'
import { goLobby, uiStore } from '../stores/ui'

const route = useRoute()
const router = useRouter()
const tab = ref('code')

const tabs = computed(() => [
  { value: 'code', label: t('editor.tabCode') },
  { value: 'docs', label: t('editor.tabDocs') },
  { value: 'tex', label: t('editor.tabTex') },
  { value: 'settings', label: t('editor.tabSettings') },
])

const preset = computed(() => getPreset(String(route.params.presetId ?? '')))
const nameDraft = ref(preset.value?.name ?? '')

watch(() => route.params.presetId, () => {
  nameDraft.value = preset.value?.name ?? ''
})

/** 保存：名字与代码写回当前预设（内置预设会被自动转为副本），随后停在副本上继续编辑 */
function savePreset(): void {
  if (!preset.value)
    return
  const saved = saveCodeToPreset(preset.value.id, codes.P1, nameDraft.value)
  if (!saved)
    return
  // 转为副本时换路由参数（replace 不留历史）；场景导演看到同一份代码，不会重启预览
  if (saved.id !== preset.value.id)
    router.replace({ name: 'editor', params: { presetId: saved.id } })
  nameDraft.value = saved.name
  pushConsole('sys', msg('console.savedPreset', { name: saved.name }))
}
</script>

<template>
  <!-- 编辑交互层：叠在常驻舞台（单人预览局）之上。根层不拦截指针——键鼠属于画布
       （InputSystem），只有页头 / 书脊 / 工作区回收指针 -->
  <div class="color-base font-sans flex flex-col pointer-events-none inset-0 absolute">
    <!-- 页头与预览浮层随工作区收展同步让位（与舞台内收、面板宽度同一时长同缓动） -->
    <div
      class="transition-[margin-right] flex flex-1 flex-col min-h-0 duration-250 ease-out"
      :class="uiStore.panelOpen ? 'mr-126' : 'mr-6'"
    >
      <header class="px-2 py-1.5 border-b border-base bg-base flex flex-wrap gap-2 pointer-events-auto items-center">
        <ActionButton size="sm" icon="i-ph:arrow-left" @click="goLobby()">
          {{ t('nav.lobby') }}
        </ActionButton>
        <span class="text-sm color-muted shrink-0">{{ t('editor.editPreset') }}</span>
        <FormTextInput
          v-model="nameDraft" size="sm" class="w-40" :placeholder="t('editor.presetName')"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
        <div class="flex-1" />
        <ActionButton
          variant="primary" size="sm" icon="i-ph:floppy-disk"
          :disabled="!preset" @click="savePreset()"
        >
          {{ t('editor.savePreset') }}
        </ActionButton>
      </header>

      <!-- 舞台浮层：预览徽标 / 状态 / 重启按钮（画布在 GameStage，这里只放标注） -->
      <div class="flex-1 min-h-0 relative">
        <div class="flex gap-2 pointer-events-none items-center left-2 top-2 absolute z-hud">
          <span class="text-mini color-muted px-2 py-0.5 border border-base rounded-full bg-black/60">
            {{ t('editor.previewBadge') }}
          </span>
          <span class="text-mini" :class="gameStore.status.P1.error ? 'color-scale-critical' : 'color-muted'">
            {{ t(gameStore.status.P1.key) }}
          </span>
        </div>
        <ActionButton
          class="pointer-events-auto right-2 top-2 absolute z-hud" size="sm" icon="i-ph:arrow-counter-clockwise"
          @click="gameApi?.run()"
        >
          {{ t('editor.restartPreview') }}
        </ActionButton>
      </div>
    </div>
  </div>

  <!-- 右：代码编辑。id 契约：InputSystem 依赖 #editor-panel 区分编辑器按键与游戏按键。
       折叠时 aside 宽度归零、内容保持 w-120 只做裁剪（Monaco 无需重排）；
       左缘边界由 PanelToggle 书脊把手承担 -->
  <PanelToggle />
  <aside
    id="editor-panel"
    class="bg-base flex shrink-0 flex-col pointer-events-auto transition-[width] duration-250 ease-out inset-y-0 right-0 absolute of-hidden"
    :class="uiStore.panelOpen ? 'w-120' : 'w-0'"
  >
    <div class="flex flex-1 flex-col min-h-0 w-120">
      <LayoutTabs v-model="tab" :tabs="tabs" />
      <div class="flex flex-1 flex-col min-h-0">
        <CodeTab v-show="tab === 'code'" solo />
        <DocsTab v-show="tab === 'docs'" />
        <TextureTab v-show="tab === 'tex'" />
        <SettingsTab v-show="tab === 'settings'" />
      </div>
    </div>
  </aside>
</template>
