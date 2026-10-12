/**
 * 在线对战接口预留（M6）—— 本期不实现联机，只固化边界：
 *
 * 设计前提（已满足）：
 *  - `Snapshot`（src/sdk/protocol.ts）是纯 JSON 快照：每帧每个角色一份，
 *    含关节角 / 部件位姿 / 输入状态，可直接序列化给远端做表现或校验。
 *  - `SdkCommand` 是纯 JSON 指令批，与 Worker 消息协议一致 —— 远端玩家的
 *    指令批可以在 applyCmds()（src/main.ts）处与本地指令合流。
 *  - 输入事件 `InputEventMsg` 同样可序列化，适合"只同步输入"的帧同步方案。
 *
 * 接入点（实现联机时替换 adapter 即可，不改游戏循环）：
 *  1. 本地输入 → `send({ kind: 'input', ... })` 发给远端；
 *  2. 远端指令批 → `onMessage` 回调 → 与本地 cmds 一起送 applyCmds；
 *  3. 权威/校验：定期 `send({ kind: 'snapshot', ... })` 比对回滚。
 *
 * `LocalLoopbackAdapter` 是零网络实现：消息原样回环，供测试与单机回放复用。
 */

import type { InputEventMsg, SdkCommand, Snapshot } from '../sdk/protocol'

export type NetMessage
  = | { kind: 'input', seq: number, events: InputEventMsg[] }
    | { kind: 'commands', seq: number, cmds: SdkCommand[], fighterId: 'P1' | 'P2' }
    | { kind: 'snapshot', seq: number, snapshot: Snapshot }
    | { kind: 'hello', version: string }
    | { kind: 'bye', reason?: string }

export interface NetworkAdapter {
  /** 适配器标识，如 'loopback' | 'ws' | 'webrtc' */
  readonly id: string
  connect: (url: string) => Promise<void>
  send: (msg: NetMessage) => void
  onMessage: (cb: (msg: NetMessage) => void) => void
  close: () => void
  readonly connected: boolean
}

/** 本地回环：send 的消息在下一次微任务里原样递回（占位实现，供测试/回放）。 */
export class LocalLoopbackAdapter implements NetworkAdapter {
  readonly id = 'loopback'
  private cb: ((msg: NetMessage) => void) | null = null
  private seq = 0

  get connected(): boolean {
    return this.cb !== null
  }

  connect(_url: string): Promise<void> {
    // 回环无需真实连接
    return Promise.resolve()
  }

  send(msg: NetMessage): void {
    if (!this.cb)
      return
    this.seq++
    const cb = this.cb
    queueMicrotask(() => cb(msg))
  }

  onMessage(cb: (msg: NetMessage) => void): void {
    this.cb = cb
  }

  close(): void {
    this.cb = null
  }

  /** 当前序号（测试用） */
  get lastSeq(): number {
    return this.seq
  }
}

/** 工厂：未来按配置返回 WebSocket/WebRTC 适配器，游戏代码不感知差异。 */
export function createNetworkAdapter(): NetworkAdapter {
  return new LocalLoopbackAdapter()
}
