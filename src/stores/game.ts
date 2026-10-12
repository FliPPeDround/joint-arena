import type { FighterId } from '../config'
import type { CreateGameOptions } from '../engine/game'
import type { FighterState } from '../physics/fighterBody'
import { reactive, shallowRef, watch } from 'vue'
import { DEFAULT_CODE } from '../editor/examples'

export type ConsoleLevel = 'info' | 'warn' | 'error' | 'sys'

export interface ConsoleLine {
  fighter: string
  level: ConsoleLevel
  text: string
}

export interface FighterStatus {
  text: string
  error: boolean
}

export interface DebugToggles {
  colliders: boolean
  joints: boolean
  bones: boolean
  rays: boolean
}

/** 纹理预览所需的图集帧信息 */
export interface AtlasFrame {
  x: number
  y: number
  w: number
  h: number
}

/** 游戏引擎暴露给 UI 的操作接口（由 createGame 装配后写入） */
export interface GameApi {
  run: () => void
  stop: () => void
  reset: () => void
  /** 场景模式热切换（世界常驻）：solo 预览 / demo 演武 / 完整对抗；run = 切换后立即开局 */
  setMode: (opts: CreateGameOptions, run?: boolean) => void
  setDebug: (toggles: Partial<DebugToggles>) => void
  previewPartColor: (part: string, color: string) => void
  resetPart: (part: string) => void
  getAtlasFrame: (part: string) => AtlasFrame | null
  getDefaultTextureSource: () => HTMLCanvasElement | null
  /** 释放引擎（离开对战/编辑页时调用）：停 Worker、停渲染循环、解绑监听 */
  dispose: () => void
}

export const CONSOLE_MAX_LINES = 300

const LS_KEY = (id: FighterId): string => `joint-arena.code.${id}`

function loadCode(id: FighterId): string {
  return localStorage.getItem(LS_KEY(id)) ?? DEFAULT_CODE[id]
}

/** 引擎 → UI 的单向数据：HUD / 控制台 / 状态 */
export const gameStore = reactive({
  booted: false,
  bootError: '',
  hud: {
    hp: { P1: 100, P2: 100 } as Record<FighterId, number>,
    roundTime: 99,
    state: { P1: 'normal', P2: 'normal' } as Record<FighterId, FighterState>,
    banner: { visible: false, main: '', sub: '' },
  },
  status: {
    P1: { text: '未运行', error: false },
    P2: { text: '未运行', error: false },
  } as Record<FighterId, FighterStatus>,
  /** 本回合胜负（null = 进行中）；引擎在分出胜负时写入并记入用户档案 */
  matchWinner: null as null | FighterId | 'draw',
  consoleLines: [] as ConsoleLine[],
  boundKeys: { P1: [] as string[], P2: [] as string[] } as Record<FighterId, string[]>,
  debug: { colliders: true, joints: true, bones: false, rays: true } as DebugToggles,
})

/** 引擎装配前的会话状态复位（控制台 / HUD / 状态标签都是单局会话数据） */
export function resetSessionState(): void {
  gameStore.booted = false
  gameStore.bootError = ''
  gameStore.hud.hp = { P1: 100, P2: 100 }
  gameStore.hud.roundTime = 99
  gameStore.hud.state = { P1: 'normal', P2: 'normal' }
  gameStore.hud.banner = { visible: false, main: '', sub: '' }
  gameStore.matchWinner = null
  gameStore.status.P1 = { text: '未运行', error: false }
  gameStore.status.P2 = { text: '未运行', error: false }
  gameStore.boundKeys.P1 = []
  gameStore.boundKeys.P2 = []
  clearConsole()
}

/** 双方玩家代码（Monaco 模型的数据源，变更即持久化） */
export const codes = reactive<Record<FighterId, string>>({
  P1: loadCode('P1'),
  P2: loadCode('P2'),
})

watch(codes, (v) => {
  for (const id of ['P1', 'P2'] as const)
    localStorage.setItem(LS_KEY(id), v[id])
}, { deep: true })

/** 引擎句柄（shallowRef：引擎对象体积大且无需深度响应） */
export const gameApi = shallowRef<GameApi | null>(null)

export function pushConsole(level: ConsoleLevel, text: string, fighter = ''): void {
  gameStore.consoleLines.push({ fighter, level, text })
  if (gameStore.consoleLines.length > CONSOLE_MAX_LINES)
    gameStore.consoleLines.splice(0, gameStore.consoleLines.length - CONSOLE_MAX_LINES)
}

export function setStatus(id: FighterId, text: string, error = false): void {
  gameStore.status[id] = { text, error }
}

export function setBoundKeys(id: FighterId, keys: string[]): void {
  gameStore.boundKeys[id] = [...keys]
}

export function clearConsole(): void {
  gameStore.consoleLines.length = 0
}
