import { useLocalStorage } from '@vueuse/core'
import { reactive, watch } from 'vue'
import { router } from '../router'
import { getPreset } from './presets'

const panelOpenStored = useLocalStorage('joint-arena.panel-open', true)

export const uiStore = reactive({
  /** 编辑场景右侧工作区是否展开（折叠后舞台占满整行），跨场景共享并持久化 */
  panelOpen: panelOpenStored.value,
})

watch(() => uiStore.panelOpen, (v) => {
  panelOpenStored.value = v
})

export function toggleEditorPanel(): void {
  uiStore.panelOpen = !uiStore.panelOpen
}

/**
 * —— 场景导航（游戏语义：路由即场景，导航前校验目标存在；
 * 进入场景时的代码装载与引擎模式切换由 GameStage 的场景导演统一执行） ——
 */
export function goLobby(): void {
  router.push({ name: 'lobby' })
}

export function openEditor(presetId: string): void {
  if (!getPreset(presetId))
    return
  router.push({ name: 'editor', params: { presetId } })
}

/** 训练模式：本地预设代码 vs 内建格斗 AI，进对战场景即开局 */
export function startTraining(presetId: string): void {
  if (!getPreset(presetId))
    return
  router.push({ name: 'battle', params: { presetId } })
}
