<script setup lang="ts">
import type { MsgKey } from '../i18n'
import type { DebugToggles } from '../stores/game'
import DisplayKbd from '@antfu/design/components/Display/DisplayKbd.vue'
import FormSwitch from '@antfu/design/components/Form/FormSwitch.vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { t } from '../i18n'
import { gameApi, gameStore } from '../stores/game'
import { goLobby } from '../stores/ui'
import LanguageSwitch from './LanguageSwitch.vue'

const open = ref(false)
const page = ref<'main' | 'settings'>('main')
const panelRef = ref<HTMLElement>()

const debugKeys: (keyof DebugToggles)[] = ['colliders', 'joints', 'bones', 'rays']

/** 重开一局：重载双方角色代码并重置回合（训练模式 P1 代码来自大厅选中的预设） */
function restart(): void {
  open.value = false
  gameApi.value?.run()
}

function openMenu(): void {
  open.value = true
}

const mainItems: { label: MsgKey, action: () => void }[] = [
  { label: 'menu.resume', action: () => { open.value = false } },
  { label: 'menu.restart', action: restart },
  { label: 'menu.settings', action: () => { page.value = 'settings' } },
  { label: 'menu.backToLobby', action: goLobby },
]

// 打开 / 切页后把焦点交给面板第一个按钮：Enter 确认、Tab 轮转、ESC 关闭
// 关闭时复位到主页：下次呼出一律从主菜单开始
watch([open, page], async () => {
  if (!open.value)
    page.value = 'main'
  await nextTick()
  panelRef.value?.querySelector<HTMLButtonElement>('button')?.focus()
})

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape')
    open.value = !open.value
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

const fighterColor: Record<string, string> = { P1: 'var(--ja-p1)', P2: 'var(--ja-p2)' }
/** 只显示绑定了按键的角色行 */
const boundEntries = computed(() => Object.entries(gameStore.boundKeys).filter(([, keys]) => keys.length > 0))
</script>

<template>
  <!-- 入口：右下角小徽标（血条 HUD 占顶部，底部角落空着）；展开后由弹层接管 -->
  <button
    v-if="!open"
    type="button"
    class="text-mini color-faint font-mono px-2.5 py-1 border border-base rounded-full bg-black/60 flex gap-1.5 cursor-pointer pointer-events-auto transition items-center bottom-3 right-3 absolute z-hud hover:color-base hover:bg-black/85 focus-visible:ring-2 focus-visible:ring-primary-500/40"
    @click="openMenu()"
  >
    <span class="i-ph:list text-xs" aria-hidden="true" />
    {{ t('menu.esc') }}
  </button>

  <!-- 游戏式菜单弹层：压暗舞台 + 大字宋体菜单项（菜单不暂停战斗，战场在幕布后继续） -->
  <div
    v-if="open"
    class="bg-black/75 flex pointer-events-auto items-center inset-0 justify-center absolute z-dropdown"
    role="dialog"
    aria-modal="true"
    :aria-label="t('menu.aria')"
    @click.self="open = false"
  >
    <div ref="panelRef" class="text-white flex flex-col min-w-60">
      <template v-if="page === 'main'">
        <div class="i18n-display text-mini tracking-[0.5em] font-mono mb-5 op-45 select-none">
          {{ t('menu.title') }}
        </div>
        <button
          v-for="item in mainItems"
          :key="item.label"
          type="button"
          class="group py-1.5 text-left outline-none flex gap-4 cursor-pointer items-center"
          @click="item.action()"
        >
          <span class="bg-primary-400 shrink-0 h-2 w-2 rotate-45 scale-0 transition-transform duration-200 group-focus-visible:scale-100 group-hover:scale-100" aria-hidden="true" />
          <span class="i18n-display text-4xl tracking-[0.3em] font-bold font-display op-60 transition-opacity group-focus-visible:op-100 group-hover:op-100">{{ t(item.label) }}</span>
        </button>
      </template>

      <template v-else>
        <div class="i18n-display text-mini tracking-[0.5em] font-mono mb-5 op-45 select-none">
          {{ t('menu.settings') }}
        </div>
        <div class="flex flex-col gap-2 w-56">
          <FormSwitch
            v-for="k in debugKeys"
            :key="k"
            v-model="gameStore.debug[k]"
            :label="t(`debug.${k}`)"
          />
        </div>

        <div class="text-sm tracking-wider font-bold mb-2 mt-6 op-80">
          {{ t('common.language') }}
        </div>
        <LanguageSwitch class="w-max" />

        <div class="text-sm tracking-wider font-bold mb-2 mt-6 op-80">
          {{ t('menu.keyBindings') }}
        </div>
        <div v-if="boundEntries.length" class="flex flex-col gap-1.5">
          <div v-for="[f, keys] in boundEntries" :key="f" class="text-sm flex gap-1.5 items-center">
            <b class="font-mono w-6" :style="{ color: fighterColor[f] }">{{ f }}</b>
            <DisplayKbd v-for="k in keys" :key="k" :keys="k" />
          </div>
        </div>
        <div v-else class="text-sm op-45">
          {{ t('menu.keysEmpty') }}
        </div>

        <button
          type="button"
          class="group mt-8 text-left outline-none flex gap-4 cursor-pointer items-center"
          @click="page = 'main'"
        >
          <span class="bg-primary-400 shrink-0 h-2 w-2 rotate-45 scale-0 transition-transform duration-200 group-focus-visible:scale-100 group-hover:scale-100" aria-hidden="true" />
          <span class="i18n-display text-3xl tracking-[0.3em] font-bold font-display op-60 transition-opacity group-focus-visible:op-100 group-hover:op-100">{{ t('menu.back') }}</span>
        </button>
      </template>
    </div>
  </div>
</template>
