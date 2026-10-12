<script setup lang="ts">
import type { CreateGameOptions } from '../engine/game'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { botCode } from '../editor/examples'
import { createGame } from '../engine/game'
import { t } from '../i18n'
import { codes, gameApi, gameStore } from '../stores/game'
import { getPreset } from '../stores/presets'
import { uiStore } from '../stores/ui'

const route = useRoute()
const canvasRef = ref<HTMLCanvasElement>()

/** 路由场景 → 引擎玩法模式：大厅 = 演武 demo，编辑 = 单人预览，对战 = 完整对抗 */
function sceneMode(name: unknown): CreateGameOptions {
  if (name === 'lobby')
    return { demo: true }
  if (name === 'editor')
    return { solo: true }
  return {}
}

/** 进入场景是否立即开局：对战进场即开打（游戏语义，深链/刷新同理）；M0 渲染演示由引擎自行驱动 */
function sceneRun(name: unknown): boolean {
  if (name === 'battle')
    return route.query.mode !== 'm0'
  return true
}

function sameMode(a: CreateGameOptions, b: CreateGameOptions): boolean {
  return (a.solo ?? false) === (b.solo ?? false) && (a.demo ?? false) === (b.demo ?? false)
}

// ---- 场景导演：路由变化 → 装载该场景的代码 → 热切换引擎玩法模式 ----
// 世界与画布常驻，切场景不重建引擎；这里决定「进入某场景时世界该演什么」。

let booted = false
let bootedMode: CreateGameOptions = {}
/** 导演意图暂存：引擎还在启动时先记下目标场景，启动完成后补切 */
let pending: { mode: CreateGameOptions, run: boolean } | null = null

function takePending(): { mode: CreateGameOptions, run: boolean } | null {
  const p = pending
  pending = null
  return p
}

function directScene(): void {
  const name = route.name
  // 场景进入时的代码装载：编辑载入预设到 P1 工作缓冲；训练对战载入「预设 vs 内建 AI」
  if (name === 'editor') {
    const p = getPreset(String(route.params.presetId ?? ''))
    if (p)
      codes.P1 = p.code
  }
  else if (name === 'battle') {
    const p = getPreset(String(route.params.presetId ?? ''))
    if (p) {
      codes.P1 = p.code
      codes.P2 = botCode()
    }
  }
  const desired = { mode: sceneMode(name), run: sceneRun(name) }
  if (!booted) {
    pending = desired
    return
  }
  if (!sameMode(bootedMode, desired.mode)) {
    gameApi.value?.setMode(desired.mode, desired.run)
    bootedMode = desired.mode
  }
  pending = null
}

watch(() => route.fullPath, directScene, { immediate: true })

// ---- 引擎装配：应用生命周期内只 boot 一次，画布永不卸载 ----
onMounted(async () => {
  try {
    const first = takePending() ?? { mode: sceneMode(route.name), run: sceneRun(route.name) }
    await createGame(canvasRef.value!, first.mode)
    bootedMode = first.mode
    if (first.run)
      gameApi.value?.run()
    // 启动期间路由又变了：directScene 只会更新 pending，这里补切到最新场景
    const late = takePending()
    if (late && gameApi.value && !sameMode(bootedMode, late.mode)) {
      gameApi.value.setMode(late.mode, late.run)
      bootedMode = late.mode
    }
    booted = true
  }
  catch (err) {
    gameStore.bootError = err instanceof Error ? (err.stack ?? err.message) : String(err)
  }
})

onUnmounted(() => {
  gameApi.value?.dispose()
})

// 编辑场景给右侧工作区让位：舞台右缘内收一个面板宽，与面板宽度动画同步（250ms）
const stageClass = computed(() => route.name === 'editor' && uiStore.panelOpen ? 'right-120' : 'right-0')
</script>

<template>
  <!-- 常驻舞台：#game-wrap 是引擎 DOM 契约（GameApp 尺寸自适应挂在这里）。
       世界不随场景切换卸载——大厅演武、编辑预览、对战是同一个世界的不同玩法 -->
  <div
    id="game-wrap"
    class="bg-base transition-[right] duration-250 ease-out inset-y-0 left-0 absolute of-hidden"
    :class="stageClass"
  >
    <canvas
      ref="canvasRef" class="h-full w-full block transition-opacity duration-700"
      :class="gameStore.booted ? 'op-100' : 'op-0'"
    />

    <!-- 启动失败：引擎不可用时给出可读的错误与出路 -->
    <div v-if="gameStore.bootError" class="p-8 flex items-center inset-0 justify-center absolute z-banner" role="alert">
      <div class="max-w-160 w-full">
        <div class="text-2xl color-scale-critical font-bold font-display">
          {{ t('stage.bootFailed') }}
        </div>
        <pre class="text-mini color-muted font-mono mt-3 p-4 border border-base rounded-md bg-base max-h-60 whitespace-pre-wrap of-auto">{{ gameStore.bootError }}</pre>
      </div>
    </div>
  </div>
</template>
