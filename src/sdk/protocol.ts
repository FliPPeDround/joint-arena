import type { FighterId } from '../config'
import type { SdkErrorArgs, SdkErrorKey } from './sdkError'

/** ---------------- 快照（主线程 → Worker，SDK 同步读） ---------------- */
export interface BoneSnapshot {
  /** 轴心世界坐标（y 向上） */
  x: number
  y: number
  /** 速度 px/s */
  vx: number
  vy: number
  /** 部件轴角度（度） */
  rot: number
}

export interface FighterSnapshot {
  id: FighterId
  hp: number
  facing: 1 | -1
  state: 'normal' | 'stun' | 'down' | 'ko'
  /** 关节语义角（度，0=静止姿态） */
  joints: Record<string, number>
  bones: Record<string, BoneSnapshot>
  /** 每个部件接触到的对象：'ground' | 'wall_L' | 'P2:head' ... */
  contacts: Record<string, string[]>
}

export interface Snapshot {
  time: number
  roundTime: number
  self: FighterSnapshot
  opp: FighterSnapshot
  keys: Record<string, boolean>
  mouse: { x: number, y: number, buttons: number }
  balanceStrength: number
}

/** ---------------- 指令（Worker → 主线程） ---------------- */
export type SdkCommand
  = | { c: 'setJointMotor', joint: string, target: number, speed: number, maxTorque?: number }
    | { c: 'setJointAngle', joint: string, angle: number }
    | { c: 'rotateJoint', joint: string, delta: number }
    | { c: 'setJointTorque', joint: string, torque: number }
    | { c: 'setJointLimits', joint: string, min: number, max: number }
    | { c: 'setBalance', strength: number }
    | { c: 'applyRootForce', fx: number, fy: number }
    | { c: 'setRootVelocity', vx: number, vy: number }
    | { c: 'setPartColor', part: string, color: number | string }
    | { c: 'setPartTexture', part: string, url: string }
    | { c: 'setPartBitmap', part: string, bitmap: ImageBitmap }
    | { c: 'resetPart', part: string }
    | { c: 'setPartScale', part: string, sx: number, sy: number }
    | { c: 'setPartOffset', part: string, ox: number, oy: number }
    | { c: 'debugRay', ox: number, oy: number, dx: number, dy: number, dist: number, hit: boolean, hx: number, hy: number }

/** ---------------- 输入事件 ---------------- */
export type InputEventMsg
  = | { kind: 'key', key: string, phase: 'down' | 'up' }
    | { kind: 'mouse', button: number, phase: 'down' | 'up', x: number, y: number }
    | { kind: 'mousemove', x: number, y: number }

/** ---------------- SDK 事件（主线程 → Worker → onEvent） ---------------- */
export type SdkEvent
  = | { type: 'roundStart' }
    | { type: 'roundEnd', winner: FighterId | 'draw' }
    | { type: 'hit', damage: number, from: FighterId, dir: number }
    | { type: 'dealHit', damage: number, to: FighterId }
    | { type: 'stateChange', state: 'normal' | 'stun' | 'down' | 'ko' }

/** ---------------- 消息 ---------------- */
export type HostToWorker
  = | { type: 'init', id: FighterId, code: string }
    | { type: 'tick', dt: number, snapshot: Snapshot }
    | { type: 'inputEvents', events: InputEventMsg[] }
    | { type: 'sdkEvents', events: SdkEvent[] }
    | { type: 'destroy' }

export type WorkerToHost
  = | { type: 'ready' }
    | { type: 'tickDone', cmds: SdkCommand[] }
    | { type: 'cmds', cmds: SdkCommand[] }
    | { type: 'log', text: string, level: 'info' | 'warn' | 'error' }
    /**
     * 错误：key / args 是 SdkError 的错误码与插值参数（宿主按当前语言查文案），
     * message 始终是原文，给玩家代码自己抛出的异常兜底。
     */
    | { type: 'error', message: string, fatal: boolean, key?: SdkErrorKey, args?: SdkErrorArgs }
    | { type: 'boundKeys', keys: string[] }
