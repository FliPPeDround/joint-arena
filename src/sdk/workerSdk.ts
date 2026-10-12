import type {
  FighterSnapshot,
  InputEventMsg,
  SdkCommand,
  Snapshot,
  WorkerToHost,
} from './protocol'
import { segSegDistance } from '../core/utils'
import {
  ALL_PARTS,
  JOINT_BY_PART,
  PARTS,
} from '../skeleton/partDefs'
import { SdkError } from './sdkError'

export interface RayHit {
  hit: boolean
  distance: number
  point: { x: number, y: number }
  part: string
}

interface Capsule {
  x1: number
  y1: number
  x2: number
  y2: number
  r: number
  name: string
}

const ARENA_HALF = 950

/**
 * Worker 内运行的 SDK 实现。
 * 读操作全部来自主线程推送的最新快照（同步、零往返）；
 * 写操作进入指令缓冲，随 tickDone / cmds 消息发回主线程执行。
 */
export function createSdk(post: (m: WorkerToHost) => void) {
  let snapshot: Snapshot | null = null
  let deltaTime = 0
  let time = 0
  const cmds: SdkCommand[] = []
  const initCbs: (() => void)[] = []
  const tickCbs: ((dt: number) => void)[] = []
  const eventCbs: ((e: unknown) => void)[] = []
  const destroyCbs: (() => void)[] = []
  const keyCbs = new Map<string, ((e: { key: string }) => void)[]>()
  const mouseCbs = new Map<number, ((e: { button: number, x: number, y: number }) => void)[]>()
  let logCountThisTick = 0

  const VALID_PARTS = new Set(ALL_PARTS)

  /**
   * 统一部件 key → 内部关节名。
   * SDK 对外只有部件 key（行动 / 外观 / 传感器同一套名字），内部关节名不对外暴露。
   */
  function normJoint(key: string): string {
    const j = JOINT_BY_PART[key]
    if (j)
      return j.joint
    if (key === 'hip')
      throw new SdkError('hipIsRoot')
    throw new SdkError('unknownPartJoint', { key, parts: ALL_PARTS.join(', ') })
  }

  function needSnapshot(): Snapshot {
    if (!snapshot)
      throw new SdkError('noSnapshot')
    return snapshot
  }
  function assertPart(name: string): void {
    if (!VALID_PARTS.has(name))
      throw new SdkError('unknownPart', { name, parts: ALL_PARTS.join(', ') })
  }
  function push(cmd: SdkCommand): void {
    if (cmds.length >= 500)
      throw new SdkError('tooManyCmds')
    cmds.push(cmd)
  }
  function num(v: unknown, name: string): number {
    const n = Number(v)
    if (!Number.isFinite(n))
      throw new SdkError('notFinite', { name, got: String(v) })
    return n
  }

  const mouseButtonIndex = (button: string | number): number => {
    if (typeof button === 'number')
      return button
    const map: Record<string, number> = { left: 0, middle: 1, right: 2 }
    return map[button.toLowerCase()] ?? 0
  }

  const sdk = {
    /** 统一部件枚举：行动 / 外观 / 传感器共用这一套 key（值 = 部件名，如 P.FOREARM_R = 'forearm_R'） */
    P: Object.freeze(Object.fromEntries(ALL_PARTS.map(p => [p.toUpperCase(), p]))),
    /** 可用部件名列表 */
    PARTS: [...ALL_PARTS],

    // ---------- 生命周期 ----------
    onInit(cb: () => void) {
      if (typeof cb === 'function')
        initCbs.push(cb)
    },
    onTick(cb: (dt: number) => void) {
      if (typeof cb === 'function')
        tickCbs.push(cb)
    },
    onEvent(cb: (e: unknown) => void) {
      if (typeof cb === 'function')
        eventCbs.push(cb)
    },
    onDestroy(cb: () => void) {
      if (typeof cb === 'function')
        destroyCbs.push(cb)
    },

    // ---------- 关节控制（统一部件 key：动作 = 该部件绕父部件的关节旋转，如 P.FOREARM_R = 弯肘） ----------
    setJointAngle(part: string, angle: number) {
      push({ c: 'setJointAngle', joint: normJoint(part), angle: num(angle, 'angle') })
    },
    rotateJoint(part: string, deltaAngle: number) {
      push({ c: 'rotateJoint', joint: normJoint(part), delta: num(deltaAngle, 'deltaAngle') })
    },
    getJointAngle(part: string): number {
      return needSnapshot().self.joints[normJoint(part)] ?? 0
    },
    setJointTorque(part: string, torque: number) {
      push({ c: 'setJointTorque', joint: normJoint(part), torque: num(torque, 'torque') })
    },
    setJointMotor(part: string, targetAngle: number, speed = 360, maxTorque?: number) {
      push({
        c: 'setJointMotor',
        joint: normJoint(part),
        target: num(targetAngle, 'targetAngle'),
        speed: num(speed, 'speed'),
        maxTorque: maxTorque === undefined ? undefined : num(maxTorque, 'maxTorque'),
      })
    },
    setJointLimits(part: string, minAngle: number, maxAngle: number) {
      push({ c: 'setJointLimits', joint: normJoint(part), min: num(minAngle, 'minAngle'), max: num(maxAngle, 'maxAngle') })
    },

    // ---------- 骨骼与传感器 ----------
    getBonePosition(bone: string): { x: number, y: number } {
      assertPart(bone)
      const b = needSnapshot().self.bones[bone]
      return { x: b.x, y: b.y }
    },
    getBoneVelocity(bone: string): { x: number, y: number } {
      assertPart(bone)
      const b = needSnapshot().self.bones[bone]
      return { x: b.vx, y: b.vy }
    },
    getBoneRotation(bone: string): number {
      assertPart(bone)
      return needSnapshot().self.bones[bone].rot
    },
    getOpponentBonePosition(bone: string): { x: number, y: number } {
      assertPart(bone)
      const b = needSnapshot().opp.bones[bone]
      return { x: b.x, y: b.y }
    },
    getContacts(bone: string): string[] {
      assertPart(bone)
      return needSnapshot().self.contacts[bone] ?? []
    },
    getDistanceTo(target: string): number {
      const snap = needSnapshot()
      let other: { x: number, y: number }
      if (target.startsWith('opp:')) {
        const bone = target.slice(4)
        assertPart(bone)
        other = snap.opp.bones[bone]
      }
      else {
        assertPart(target)
        other = snap.self.bones[target]
      }
      const me = snap.self.bones.torso
      return Math.hypot(other.x - me.x, other.y - me.y)
    },
    /** 射线检测：origin {x,y}，direction {x,y}（会归一化），distance 上限 */
    raycast(origin: { x: number, y: number }, direction: { x: number, y: number }, distance: number): RayHit {
      const snap = needSnapshot()
      const ox = num(origin?.x, 'origin.x'); const oy = num(origin?.y, 'origin.y')
      const dx = num(direction?.x, 'direction.x'); const dy = num(direction?.y, 'direction.y')
      const dist = Math.min(800, Math.max(1, num(distance, 'distance')))
      const len = Math.hypot(dx, dy) || 1
      const nx = dx / len; const ny = dy / len

      const result: RayHit = { hit: false, distance: dist, point: { x: ox + nx * dist, y: oy + ny * dist }, part: '' }
      let best = dist

      // 静态：地面 / 墙
      if (ny < -1e-6 && oy > 0) {
        const t = oy / -ny
        if (t < best) { best = t; result.part = 'ground' }
      }
      for (const [wx, name] of [[-ARENA_HALF, 'wall_L'], [ARENA_HALF, 'wall_R']] as const) {
        if (Math.abs(nx) > 1e-6) {
          const t = (wx - ox) / nx
          if (t > 0 && t < best) { best = t; result.part = name }
        }
      }
      // 动态：双方部件（胶囊近似）
      const caps: Capsule[] = []
      const build = (fs: FighterSnapshot, prefix: string) => {
        for (const [bone, b] of Object.entries(fs.bones)) {
          const def = PARTS[bone]
          const a = Math.atan2(b.vy, b.vx)
          void a
          const rot = (b.rot * Math.PI) / 180
          const c = Math.cos(rot); const s = Math.sin(rot)
          caps.push({
            x1: b.x,
            y1: b.y,
            x2: b.x + c * def.L,
            y2: b.y + s * def.L,
            r: def.W / 2,
            name: `${prefix}:${bone}`,
          })
        }
      }
      build(snap.self, 'self')
      build(snap.opp, 'opp')
      // 步进 + 二分细化
      const step = 6
      outer: for (let t = step; t <= dist; t += step) {
        const px = ox + nx * t; const py = oy + ny * t
        for (const cap of caps) {
          if (segSegDistance(
            { x: px, y: py },
            { x: px - nx * step, y: py - ny * step },
            { x: cap.x1, y: cap.y1 },
            { x: cap.x2, y: cap.y2 },
          ) <= cap.r) {
            let lo = t - step; let hi = t
            for (let i = 0; i < 5; i++) {
              const mid = (lo + hi) / 2
              const mx = ox + nx * mid; const my = oy + ny * mid
              const d = Math.min(...caps.map(cp =>
                segSegDistance(
                  { x: mx, y: my },
                  { x: mx - nx * 0.5, y: my - ny * 0.5 },
                  { x: cp.x1, y: cp.y1 },
                  { x: cp.x2, y: cp.y2 },
                ) - cp.r))
              if (d <= 0)
                hi = mid; else lo = mid
            }
            if (hi < best) {
              best = hi
              result.part = cap.name
            }
            break outer
          }
        }
      }
      result.hit = best < dist
      result.distance = best
      result.point = { x: ox + nx * best, y: oy + ny * best }
      push({ c: 'debugRay', ox, oy, dx: nx, dy: ny, dist, hit: result.hit, hx: result.point.x, hy: result.point.y })
      return result
    },

    // ---------- 输入 ----------
    bindKey(key: string, cb: () => void) {
      if (typeof key !== 'string' || typeof cb !== 'function')
        throw new SdkError('bindKeyArgs')
      const k = key.toLowerCase()
      if (!keyCbs.has(k))
        keyCbs.set(k, [])
      keyCbs.get(k)!.push(cb)
      post({ type: 'boundKeys', keys: [...keyCbs.keys()] })
    },
    bindMouse(button: string | number, cb: (e: { button: number, x: number, y: number }) => void) {
      if (typeof cb !== 'function')
        throw new SdkError('bindMouseArgs')
      const b = mouseButtonIndex(button)
      if (!mouseCbs.has(b))
        mouseCbs.set(b, [])
      mouseCbs.get(b)!.push(cb)
    },
    isKeyDown(key: string): boolean {
      if (typeof key !== 'string')
        return false
      return !!needSnapshot().keys[key.toLowerCase()]
    },
    isMouseDown(button: string | number): boolean {
      const b = mouseButtonIndex(button)
      return !!(needSnapshot().mouse.buttons & (1 << b))
    },
    getMousePosition(): { x: number, y: number } {
      const m = needSnapshot().mouse
      return { x: m.x, y: m.y }
    },

    // ---------- 纹理与外观 ----------
    setPartTexture(part: string, textureUrl: string) {
      assertPart(part)
      if (typeof textureUrl !== 'string' || !textureUrl)
        throw new SdkError('textureUrlArg')
      push({ c: 'setPartTexture', part, url: textureUrl })
    },
    setPartColor(part: string, color: number | string) {
      assertPart(part)
      push({ c: 'setPartColor', part, color })
    },
    setPartTextureFromCanvas(part: string, canvas: OffscreenCanvas) {
      assertPart(part)
      if (!(canvas instanceof OffscreenCanvas)) {
        throw new SdkError('offscreenRequired')
      }
      const w = canvas.width; const h = canvas.height
      if (w <= 0 || h <= 0 || w * h > 1024 * 1024)
        throw new SdkError('badCanvasSize', { w, h })
      const bitmap = canvas.transferToImageBitmap()
      push({ c: 'setPartBitmap', part, bitmap })
    },
    createCanvas(w: number, h: number): OffscreenCanvas {
      const cw = Math.round(num(w, 'w')); const ch = Math.round(num(h, 'h'))
      if (cw <= 0 || ch <= 0 || cw * ch > 1024 * 1024)
        throw new SdkError('badCanvasSize', { w: cw, h: ch })
      return new OffscreenCanvas(cw, ch)
    },
    resetPart(part: string) {
      assertPart(part); push({ c: 'resetPart', part })
    },
    setPartScale(part: string, scaleX: number, scaleY: number) {
      assertPart(part)
      push({ c: 'setPartScale', part, sx: num(scaleX, 'scaleX'), sy: num(scaleY, 'scaleY') })
    },
    setPartOffset(part: string, offsetX: number, offsetY: number) {
      assertPart(part)
      push({ c: 'setPartOffset', part, ox: num(offsetX, 'offsetX'), oy: num(offsetY, 'offsetY') })
    },

    // ---------- 辅助/扩展 ----------
    log(message: unknown) {
      if (logCountThisTick > 8)
        return
      logCountThisTick++
      post({ type: 'log', text: typeof message === 'string' ? message : JSON.stringify(message), level: 'info' })
    },
    logWarn(message: unknown) {
      post({ type: 'log', text: typeof message === 'string' ? message : JSON.stringify(message), level: 'warn' })
    },
    getTime(): number { return time },
    getDeltaTime(): number { return deltaTime },
    getHp(): number { return needSnapshot().self.hp },
    getOpponentHp(): number { return needSnapshot().opp.hp },
    getSelfState() {
      const s = needSnapshot().self
      return { hp: s.hp, state: s.state, facing: s.facing }
    },
    getOpponentState() {
      const s = needSnapshot().opp
      return { hp: s.hp, state: s.state, facing: s.facing, torso: { x: s.bones.torso.x, y: s.bones.torso.y } }
    },
    getRoundTime(): number { return needSnapshot().roundTime },
    /** 平衡辅助强度（游戏内建的姿态维持系统）0 = 关闭 */
    setBalanceStrength(v: number) {
      push({ c: 'setBalance', strength: Math.max(0, Math.min(1.6, num(v, 'strength'))) })
    },
    /** 根部受力辅助（移动用）：对髋部施加力（px/s²·质量量纲） */
    applyRootForce(fx: number, fy: number) {
      push({ c: 'applyRootForce', fx: num(fx, 'fx'), fy: num(fy, 'fy') })
    },
    /** 根部速度控制：PD 趋近目标速度（推荐移动方式） */
    setRootVelocity(vx: number, vy: number) {
      push({ c: 'setRootVelocity', vx: num(vx, 'vx'), vy: num(vy, 'vy') })
    },
    stopMoving() {
      push({ c: 'setRootVelocity', vx: 0, vy: 0 })
    },
  }

  // ---------- 内部：主线程调用 ----------

  function fireInit(): void {
    for (const cb of initCbs) cb()
    // onInit 期间产生的指令（如换肤）也要发回主线程执行
    if (cmds.length) {
      post({ type: 'cmds', cmds })
      cmds.length = 0
    }
  }

  function handleTick(dt: number, snap: Snapshot): void {
    snapshot = snap
    deltaTime = dt
    time += dt
    logCountThisTick = 0
    cmds.length = 0
    for (const cb of tickCbs) cb(dt)
    post({ type: 'tickDone', cmds })
  }

  function handleEvents(events: InputEventMsg[]): void {
    if (cmds.length) {
      // 上一次事件批的指令 flush
      post({ type: 'cmds', cmds })
      cmds.length = 0
    }
    for (const ev of events) {
      try {
        if (ev.kind === 'key') {
          if (ev.phase === 'down') {
            const cbs = keyCbs.get(ev.key)
            if (cbs) {
              for (const cb of cbs) cb({ key: ev.key })
            }
          }
          for (const cb of eventCbs) cb({ type: ev.phase === 'down' ? 'keydown' : 'keyup', key: ev.key })
        }
        else if (ev.kind === 'mouse') {
          if (ev.phase === 'down') {
            const cbs = mouseCbs.get(ev.button)
            if (cbs) {
              for (const cb of cbs) cb({ button: ev.button, x: ev.x, y: ev.y })
            }
          }
          for (const cb of eventCbs) {
            cb({ type: ev.phase === 'down' ? 'mousedown' : 'mouseup', button: ev.button, x: ev.x, y: ev.y })
          }
        }
        else {
          for (const cb of eventCbs) cb({ type: 'mousemove', x: ev.x, y: ev.y })
        }
      }
      catch (err) {
        post({ type: 'error', message: String(err), key: 'sdkErr.eventCbError', args: { err: String(err) }, fatal: false })
      }
    }
    if (cmds.length) {
      post({ type: 'cmds', cmds })
      cmds.length = 0
    }
  }

  function fireSdkEvent(e: unknown): void {
    for (const cb of eventCbs) {
      try { cb(e) }
      catch (err) {
        post({ type: 'error', message: String(err), key: 'sdkErr.onEventCbError', args: { err: String(err) }, fatal: false })
      }
    }
  }

  function fireDestroy(): void {
    for (const cb of destroyCbs) {
      try { cb() }
      catch { /* ignore */ }
    }
  }

  return { sdk, fireInit, handleTick, handleEvents, fireSdkEvent, fireDestroy }
}

export type Sandbox = ReturnType<typeof createSdk>
