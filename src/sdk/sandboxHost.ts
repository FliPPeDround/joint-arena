import type { FighterId } from '../config'
import type {
  HostToWorker,
  InputEventMsg,
  SdkCommand,
  SdkEvent,
  Snapshot,
  WorkerToHost,
} from './protocol'
import { CFG } from '../config'

export interface SandboxHostHooks {
  applyCmds: (id: FighterId, cmds: SdkCommand[]) => void
  onLog: (id: FighterId, text: string, level: 'info' | 'warn' | 'error') => void
  onError: (id: FighterId, message: string, fatal: boolean) => void
  onStall: (id: FighterId) => void
  onBoundKeys: (id: FighterId, keys: string[]) => void
  onReady: (id: FighterId) => void
}

/**
 * 主线程侧沙箱宿主：管理一个玩家代码 Worker。
 * - 每物理帧发送 tick + 快照，接收指令批
 * - 看门狗：Worker 超时无响应 → 判定死循环 → 终止
 * - 连续运行时错误 → 停用该角色逻辑
 */
export class SandboxHost {
  readonly id: FighterId
  private worker: Worker | null = null
  private hooks: SandboxHostHooks
  ready = false
  enabled = false
  running = false
  private pendingCmds: SdkCommand[] = []
  private lastReplyAt = 0
  private consecutiveErrors = 0

  constructor(id: FighterId, hooks: SandboxHostHooks) {
    this.id = id
    this.hooks = hooks
  }

  /** 用给定代码（重）启动沙箱 */
  start(code: string): void {
    this.stop()
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    this.worker = worker
    worker.onmessage = (ev: MessageEvent<WorkerToHost>) => this.handle(ev.data)
    worker.onerror = (ev) => {
      this.hooks.onError(this.id, `Worker 错误: ${ev.message}`, true)
    }
    this.running = true
    this.ready = false
    this.enabled = true
    this.consecutiveErrors = 0
    this.send({ type: 'init', id: this.id, code })
  }

  stop(): void {
    if (this.worker) {
      this.send({ type: 'destroy' })
      this.worker.terminate()
      this.worker = null
    }
    this.running = false
    this.ready = false
    this.enabled = false
    this.pendingCmds = []
  }

  private send(m: HostToWorker): void {
    this.worker?.postMessage(m)
  }

  private handle(m: WorkerToHost): void {
    this.lastReplyAt = performance.now()
    switch (m.type) {
      case 'ready':
        this.ready = true
        this.hooks.onReady(this.id)
        break
      case 'tickDone':
      case 'cmds':
        if (m.cmds.length)
          this.pendingCmds.push(...m.cmds)
        break
      case 'log':
        this.hooks.onLog(this.id, m.text, m.level)
        break
      case 'error':
        if (m.fatal) {
          this.enabled = false
          this.hooks.onError(this.id, m.message, true)
        }
        else {
          this.consecutiveErrors++
          this.hooks.onError(this.id, m.message, false)
          if (this.consecutiveErrors >= 5) {
            this.enabled = false
            this.hooks.onError(this.id, `${this.id} 连续出错 5 次，已暂停该角色逻辑（按「重置回合」恢复）`, true)
          }
        }
        break
      case 'boundKeys':
        this.hooks.onBoundKeys(this.id, m.keys)
        break
    }
  }

  sendTick(dt: number, snapshot: Snapshot): void {
    if (!this.running || !this.ready || !this.enabled)
      return
    this.send({ type: 'tick', dt, snapshot })
  }

  sendEvents(events: InputEventMsg[]): void {
    if (!this.running || !this.ready || !this.enabled || events.length === 0)
      return
    this.send({ type: 'inputEvents', events })
  }

  sendSdkEvents(events: SdkEvent[]): void {
    if (!this.running || !this.ready || !this.enabled || events.length === 0)
      return
    this.send({ type: 'sdkEvents', events })
  }

  /** 每帧调用：应用收到的指令；检查看门狗（600ms 无任何回复 = 死循环） */
  update(now: number): SdkCommand[] {
    const out = this.pendingCmds
    this.pendingCmds = []
    if (this.running && this.ready && this.enabled && now - this.lastReplyAt > CFG.workerWatchdogMs) {
      this.enabled = false
      this.stop()
      this.hooks.onStall(this.id)
    }
    return out
  }

  resetErrorCount(): void {
    this.consecutiveErrors = 0
  }
}
