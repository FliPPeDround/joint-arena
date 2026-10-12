import type { JointDef } from '../skeleton/partDefs'
import RAPIER from '@dimforge/rapier2d-compat'
import { CFG } from '../config'
import { clamp, degToRad, radToDeg, wrapAngle } from '../core/utils'
import {
  JOINT_LIST,
  JOINTS,
  PARTS,
  pivotToCenter,
  REST_POSE,
  restRotRad,
} from '../skeleton/partDefs'

/** 碰撞分组：P1 部件、P2 部件、静态场景互不重叠同组 */
export const GROUP_P1 = (0x0001 << 16) | 0xFFFE
export const GROUP_P2 = (0x0002 << 16) | 0xFFFD
export const GROUP_STATIC = (0x0004 << 16) | 0xFFFF

export interface MotorState {
  mode: 'off' | 'pos' | 'torque'
  /** pos 模式目标角（rapier 约定，弧度） */
  target: number
  /** 限速（度/秒） */
  speed: number
  /** 最大扭矩 */
  maxTorque: number
}

/** 每个关节的子部件链（child 自身 + 全部后代部件） */
const JOINT_CHAIN: Record<string, string[]> = {}
for (const j of JOINT_LIST) {
  const chain: string[] = []
  const walk = (bone: string): void => {
    chain.push(bone)
    for (const cj of JOINT_LIST) {
      if (cj.parent === bone)
        walk(cj.child)
    }
  }
  walk(j.child)
  JOINT_CHAIN[j.joint] = chain
}

/** 部件某局部锚点在静止姿态下的世界坐标 */
function anchorWorld(bone: string, anchor: [number, number]): [number, number] {
  const def = PARTS[bone]
  const rot = restRotRad(bone, 1)
  const [cx, cy] = pivotToCenter(REST_POSE[bone].pivot, rot, def.L)
  return [cx + anchor[0] * Math.cos(rot) - anchor[1] * Math.sin(rot), cy + anchor[0] * Math.sin(rot) + anchor[1] * Math.cos(rot)]
}

/**
 * 静止姿态下，把关节子链从竖直悬垂整体抬到水平所需的重力力矩（绝对值）。
 * 各部件对转轴的力臂 = 部件中心与关节锚点的 y 向距离（带符号，链上折返的部件反向抵消）。
 */
function chainHoldTorque(j: JointDef): number {
  const pivotY = anchorWorld(j.child, j.a2)[1]
  let torque = 0
  for (const bone of JOINT_CHAIN[j.joint]) {
    const def = PARTS[bone]
    const cy = pivotToCenter(REST_POSE[bone].pivot, restRotRad(bone, 1), def.L)[1]
    torque += def.mass * CFG.gravityY * (pivotY - cy)
  }
  return Math.abs(torque)
}

/**
 * 关节相对自由度的约简惯量（静止姿态）— 位置伺服 PD 增益按它标定。
 *
 * 马达驱动的被控对象是相对坐标（子体相对父体的转角），其有效惯量是
 * 子体绕锚点与父体绕锚点的串联约简。增益必须按它标定：
 *  - 按整条子链标定（旧实现）高估 3~20 倍 → 显式阻尼项 2·i·wn·dt/I_eff
 *    超出 60Hz 显式积分稳定界（<2）→ 全关节极限环抖散（实测锁姿站立
 *    0.1s 内崩塌）；
 *  - 只按子体标定也不行：单关节收敛，但 PD 的反作用扭矩（-τ 落在父体上）
 *    会以每帧数十 rad/s 踹动邻居关节，多关节联立时互相踢成持续振荡
 *    （实测 dev ±7°、膝 ±17° 的周期-2 振荡，提高求解器迭代无效）。
 * 按约简惯量标定后，每帧相对角速度增量 τ·dt/I_rel = wn(wn·err − 2vel)·dt
 * 天然有界（wn ≤ 42 → 阻尼项 ≤ 1.4），与关节间耦合解耦。
 * 静态保持精度足够：站立姿态各关节重力矩很小（腿近竖直、双臂对称抵消）。
 */
function jointDriveInertia(j: JointDef): number {
  const [ax, ay] = anchorWorld(j.child, j.a2)
  const aboutAnchor = (bone: string): number => {
    const def = PARTS[bone]
    const [cx, cy] = pivotToCenter(REST_POSE[bone].pivot, restRotRad(bone, 1), def.L)
    const d2 = (cx - ax) * (cx - ax) + (cy - ay) * (cy - ay)
    return def.mass * (def.L * def.L + def.W * def.W) / 12 + def.mass * d2
  }
  const iChild = aboutAnchor(j.child)
  const iParent = aboutAnchor(j.parent)
  return (iChild * iParent) / (iChild + iParent)
}

/** 每个关节的约简驱动惯量 */
const DRIVE_INERTIA: Record<string, number> = Object.fromEntries(
  JOINT_LIST.map(j => [j.joint, jointDriveInertia(j)]),
)

export interface FighterPartRef {
  body: RAPIER.RigidBody
  collider: RAPIER.Collider
}

export type FighterState = 'normal' | 'stun' | 'down' | 'ko'

/**
 * 平衡辅助（姿态维持系统）参数 — 游戏级规则，可用 __JA.tune() 实测调整。
 *
 * 标定依据（全体重 m·g = 5.2kg × 2200 = 11440）：
 *  - 悬停弹簧必须**明显强于**体重：静息下陷 = m·g/kH，kH=6000 → 1.9px（髋高 84→82）。
 *    旧值 kH=600 配 maxFUp=11500 只有刚好托住体重的余量，静息下陷 19px（84→65），
 *    膝链被压塌成蹲姿，且直立回复力压不住 → 锁姿站立 3s 内漂到 25°；
 *  - 直立扭矩要压得住体重倾覆力矩，否则躯干缓慢前倾；
 *  - 水平回复力把髋部拉回重心正下方（旧值 kLean=0，站立会缓慢漂移）。
 */
export const BALANCE = {
  /** 直立扭矩（dev 每弧度）— 需对全体重倾覆力矩 m·g·h ≈ 8×10^5·dev 量级 */
  kU: 1500000,
  /** 直立阻尼（角速度） */
  dU: 120000,
  /** 直立扭矩上限 */
  maxT: 900000,
  /** 悬停力（高度差每 px）— m·g/kH = 静息下陷，6000 → 约 2px */
  kH: 6000,
  /** 悬停阻尼 */
  dH: 300,
  /** 悬停向上力上限（远大于全体重，姿态维持如刚性弹簧支柱，腿部只负责摆位） */
  maxFUp: 45000,
  /** 倾斜水平回复力（dev 每弧度，把髋部拉回重心下方） */
  kLean: 40000,
  /** 水平回复力上限 */
  maxFx: 8000,
  /** 髋部水平速度阻尼（仅站立时生效，见 preStep：根部速度指令优先） */
  kDx: 60,
}

/**
 * 单个角色的物理体：15 刚体 + 14 旋转关节（限位）+ PD 马达 + 平衡辅助。
 *
 * 角度约定（实测 Rapier 0.21 模型角符号）：
 *   模型角 θm = wrap(parentRot - childRot + restRel)   （0 = 静止姿态）
 *   θm = -dir * facing * semanticAngle
 * 限位 / 马达目标 / PD 全部在 θm 域；SDK 只暴露语义角。
 */
export class FighterBody {
  readonly id: 'P1' | 'P2'
  readonly side: 1 | 2
  readonly facing: 1 | -1
  readonly world: RAPIER.World
  parts: Record<string, FighterPartRef> = {}
  joints: Record<string, RAPIER.RevoluteImpulseJoint> = {}
  private restRot: Record<string, number> = {}
  private restJointRel: Record<string, number> = {}
  private restPivot: Record<string, [number, number]> = {}
  motors: Record<string, MotorState> = {}
  defaultMaxTorque: Record<string, number> = {}
  /** 子部件转动惯量（马达 PD 增益按它计算，保证 60Hz 数值稳定） */
  childInertia: Record<string, number> = {}
  jointLimits: Record<string, [number, number]> = {} // rapier 弧度
  semanticLimits: Record<string, [number, number]> = {}

  /** 平衡辅助（姿态维持系统）：游戏级规则，玩家可调强度 */
  /** 平衡辅助（姿态维持系统）参数 — 游戏级规则，可用 __JA.tune() 实测调整 */
  balanceStrength = 1
  rootVelTarget: { active: boolean, vx: number, vy: number } = { active: false, vx: 0, vy: 0 }
  rootForce: { fx: number, fy: number } = { fx: 0, fy: 0 }

  /** 上一物理步的部件位姿（渲染插值用：pos(px,py) + 旋转 rad） */
  prevState: Record<string, { x: number, y: number, rot: number }> = {}

  /** 每次物理步进前调用：快照当前位姿为"上一帧" */
  capturePrev(): void {
    for (const [bone, ref] of Object.entries(this.parts)) {
      const t = ref.body.translation()
      this.prevState[bone] = { x: t.x, y: t.y, rot: ref.body.rotation() }
    }
  }

  state: FighterState = 'normal'
  hp: number = CFG.maxHp
  /** 倒地计时 */
  downTimer = 0

  constructor(world: RAPIER.World, id: 'P1' | 'P2', side: 1 | 2, spawnX: number) {
    this.world = world
    this.id = id
    this.side = side
    this.facing = side === 1 ? 1 : -1
    const group = side === 1 ? GROUP_P1 : GROUP_P2

    // 创建刚体
    for (const [bone, def] of Object.entries(PARTS)) {
      const rot = restRotRad(bone, this.facing)
      const pivot = REST_POSE[bone].pivot
      const [cx, cy] = pivotToCenter(pivot, rot, def.L)
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawnX + cx, cy)
        .setRotation(rot)
        .setLinearDamping(0.05)
        .setAngularDamping(0.35)
        .setCcdEnabled(def.ccd)
      const body = world.createRigidBody(bodyDesc)
      const colliderDesc = RAPIER.ColliderDesc.cuboid(def.L / 2, def.W / 2)
        .setDensity(def.mass / (def.L * def.W))
        .setCollisionGroups(group)
        .setFriction(bone.startsWith('foot') ? 1.4 : 0.85)
        .setRestitution(0.02)
        // 接触力事件（伤害判定依赖）
        .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
      if (def.colliderOffset)
        colliderDesc.setTranslation(def.colliderOffset[0], def.colliderOffset[1])
      const collider = world.createCollider(colliderDesc, body)
      this.parts[bone] = { body, collider }
      this.restRot[bone] = rot
      this.restPivot[bone] = [spawnX + pivot[0], pivot[1]]
    }

    // 创建关节
    for (const j of JOINT_LIST) {
      const b1 = this.parts[j.parent].body
      const b2 = this.parts[j.child].body
      const jd = RAPIER.JointData.revolute({ x: j.a1[0], y: j.a1[1] }, { x: j.a2[0], y: j.a2[1] })
      // Rapier 旋转关节的限位/马达作用于原始模型角 wrap(rot2 - rot1)，
      // frame1/frame2 不参与测量（实测）。因此 restModel 偏移由本类管理，
      // 且静止相对角必须远离 ±π 卷绕边界（见 partDefs REST_POSE.head 注释）。
      const restModel = wrapAngle(this.rotOf(j.child) - this.rotOf(j.parent))
      this.restJointRel[j.joint] = restModel
      const childDef0 = PARTS[j.child]
      const inertia0 = childDef0.mass * (childDef0.L * childDef0.L + childDef0.W * childDef0.W) / 12
      const maxT0 = clamp(inertia0 * 260, 60, 30000)
      this.semanticLimits[j.joint] = [j.lim[0], j.lim[1]]
      this.jointLimits[j.joint] = this.modelLimits(j.joint)
      const joint = world.createImpulseJoint(jd, b1, b2, true) as RAPIER.RevoluteImpulseJoint
      // 限位必须在创建后通过 setLimits 启用（JointData 预赋值无效）
      joint.setLimits(this.jointLimits[j.joint][0], this.jointLimits[j.joint][1])
      // 默认最大扭矩：腿关节要承受体重（重力力矩量级 m·g·L ≈ 10^5）；
      // 其余关节至少要能把子链自重抬平（×2.2 留动态余量），否则 setJointMotor
      // 的目标角在重力下不可达，指令"生效"了却看不出变化
      const isLeg = j.joint.startsWith('hip_') || j.joint.startsWith('knee_')
      const isAnkle = j.joint.startsWith('ankle')
      const maxT = isLeg
        ? 300000
        : isAnkle
          ? 180000
          : Math.max(maxT0, chainHoldTorque(j) * 2.2)
      this.defaultMaxTorque[j.joint] = maxT
      this.childInertia[j.joint] = inertia0
      this.joints[j.joint] = joint
      this.motors[j.joint] = { mode: 'off', target: 0, speed: 360, maxTorque: maxT }
    }
  }

  /** 语义限位 → 模型角限位（弧度，围绕 restModel） */
  private modelLimits(joint: string): [number, number] {
    const j = JOINTS[joint]
    const d = j.dir * this.facing
    const rest = this.restJointRel[joint] ?? 0
    return [
      rest + degToRad(Math.min(j.lim[0] * d, j.lim[1] * d)),
      rest + degToRad(Math.max(j.lim[0] * d, j.lim[1] * d)),
    ]
  }

  private rotOf(bone: string): number {
    return this.parts[bone].body.rotation()
  }

  /** 关节当前角（Rapier 模型角 wrap(rot2-rot1)，弧度） */
  jointAngleRapier(joint: string): number {
    const j = JOINTS[joint]
    return wrapAngle(this.rotOf(j.child) - this.rotOf(j.parent))
  }

  /** 关节当前角（SDK 语义角，度，0 = 静止姿态） */
  jointAngleDeg(joint: string): number {
    const j = JOINTS[joint]
    return radToDeg(wrapAngle(this.jointAngleRapier(joint) - this.restJointRel[joint]) / (j.dir * this.facing))
  }

  /** 部件轴心世界坐标（渲染/传感器用） */
  partPivot(bone: string): [number, number] {
    const { body } = this.parts[bone]
    const def = PARTS[bone]
    const t = body.translation()
    const r = body.rotation()
    return [t.x + Math.cos(r) * (-def.L / 2), t.y + Math.sin(r) * (-def.L / 2)]
  }

  partCenter(bone: string): RAPIER.Vector {
    return this.parts[bone].body.translation()
  }

  partVelocity(bone: string): RAPIER.Vector {
    return this.parts[bone].body.linvel()
  }

  partRotationDeg(bone: string): number {
    return radToDeg(this.parts[bone].body.rotation())
  }

  /** ---------------- SDK 指令 ---------------- */
  setJointMotor(joint: string, targetDeg: number, speedDeg: number, maxTorque?: number): void {
    const m = this.motors[joint]
    if (!m)
      return
    const lim = this.semanticLimits[joint]
    const t = clamp(targetDeg, lim[0], lim[1])
    m.mode = 'pos'
    m.target = this.restJointRel[joint] + degToRad(t) * JOINTS[joint].dir * this.facing
    m.speed = Math.max(30, speedDeg)
    if (maxTorque !== undefined)
      m.maxTorque = Math.max(0, maxTorque)
  }

  setJointAngle(joint: string, angleDeg: number): void {
    // 语义：刚性地设置角度 → 高刚度伺服
    this.setJointMotor(joint, angleDeg, 720, this.defaultMaxTorque[joint] * 2.2)
  }

  rotateJoint(joint: string, deltaDeg: number): void {
    const cur = this.jointAngleDeg(joint)
    this.setJointMotor(joint, cur + deltaDeg, this.motors[joint].speed, this.motors[joint].maxTorque)
  }

  setJointTorque(joint: string, torque: number): void {
    const m = this.motors[joint]
    if (!m)
      return
    m.mode = 'torque'
    m.target = torque // 语义扭矩，施加时按 dir*facing 换算
  }

  setJointLimits(joint: string, minDeg: number, maxDeg: number): void {
    const hard = this.semanticLimits[joint]
    const min = clamp(minDeg, hard[0], hard[1])
    const max = clamp(maxDeg, hard[0], hard[1])
    if (max < min)
      return
    this.semanticLimits[joint] = [min, max]
    this.jointLimits[joint] = this.modelLimits(joint)
    this.joints[joint].setLimits(this.jointLimits[joint][0], this.jointLimits[joint][1])
  }

  clearMotors(): void {
    for (const m of Object.values(this.motors)) m.mode = 'off'
    this.rootVelTarget.active = false
    this.rootForce.fx = 0; this.rootForce.fy = 0
  }

  // ---------------- 每步施加 ----------------

  /** 在 world.step 之前调用：应用马达/平衡/根部控制 */
  preStep(dt: number): void {
    const ko = this.state === 'ko'

    // 关节马达（被眩晕/倒地压制程度不同）
    let motorScale = 1
    if (ko)
      motorScale = 0
    else if (this.state === 'stun')
      motorScale = 0.12
    else if (this.state === 'down')
      motorScale = 0.6

    for (const [name, m] of Object.entries(this.motors)) {
      const j = JOINTS[name]
      const child = this.parts[j.child].body
      const parent = this.parts[j.parent].body
      const maxT = m.maxTorque * motorScale
      if (m.mode === 'pos' && motorScale > 0) {
        // 位置伺服：显式 PD 力矩。不用 rapier 内建位置马达 —— 实测 0.21 的
        // AccelerationBased 位置马达在锚点偏离质心 + 链式负载下会收敛到错误角度。
        // 增益按关节约简驱动惯量标定（见 DRIVE_INERTIA 注释）；物理以 240Hz
        // 子步推进（见 PHYS_SUBSTEPS），wn ≤ 84 时刚度/阻尼都在数值稳定界内。
        const speedRad = degToRad(m.speed)
        const wn = Math.min(Math.max(speedRad * 6, 10), 84)
        const err = wrapAngle(m.target - this.jointAngleRapier(name))
        const vel = child.angvel() - parent.angvel()
        const i = DRIVE_INERTIA[name]
        const tau = clamp(i * wn * (wn * err - 2 * vel), -maxT, maxT)
        this.applyJointTorque(parent, child, tau, dt)
      }
      else if (m.mode === 'torque' && motorScale > 0) {
        // 语义扭矩 → 模型角方向；单帧冲量（本帧各子步合计，postStep 里清 off）
        const d = j.dir * this.facing
        this.applyJointTorque(parent, child, clamp(m.target * d, -maxT, maxT), dt)
      }
      // off / 被压制：自由关节，不施力
    }

    // 平衡辅助（姿态维持）
    let bs = this.balanceStrength
    if (ko)
      bs = 0
    else if (this.state === 'stun')
      bs *= 0.15
    else if (this.state === 'down')
      bs *= this.downTimer > 1.2 ? 1.0 : 0.3 // 倒地 1.2s 后辅助起身
    if (bs > 0.001) {
      const hip = this.parts.hip.body
      const dev = wrapAngle(hip.rotation() - this.restRot.hip)
      const w = hip.angvel()
      const tau = clamp(BALANCE.kU * (-dev) - BALANCE.dU * w, -BALANCE.maxT, BALANCE.maxT) * bs
      hip.applyTorqueImpulse(tau * dt, true)
      const t = hip.translation()
      const v = hip.linvel()
      // 悬停阻尼同样参考「期望垂直速度」：站着时为 0（抗下沉），
      // 起跳（setRootVelocity 的 vy > 0）时让开，否则弹簧阻尼会把跳跃吃掉；
      // 上升到静息高度以上时悬停力归零（不再往回拽），跳跃才是抛物线。
      const refVy = this.rootVelTarget.active ? this.rootVelTarget.vy : 0
      const above = t.y > CFG.hipRestY && refVy > 0
      const fy = above
        ? 0
        : clamp(BALANCE.kH * (CFG.hipRestY - t.y) - BALANCE.dH * (v.y - refVy), -900, BALANCE.maxFUp) * bs
      hip.applyImpulse({ x: 0, y: fy * dt }, true)
      // 倾斜水平回复：把髋部拉回重心正下方 + 水平速度阻尼。
      // 阻尼参考的是「本帧期望的水平速度」：站着时是 0（抗漂移），
      // 根部速度指令生效时是目标速度（否则阻尼会与 setRootVelocity 对拉，
      // 实测把行走距离从 208px 压到 9px —— 走不动）。
      const refVx = this.rootVelTarget.active ? this.rootVelTarget.vx : 0
      const fx = clamp(-BALANCE.kLean * dev - BALANCE.kDx * (v.x - refVx), -BALANCE.maxFx, BALANCE.maxFx) * bs
      hip.applyImpulse({ x: fx * dt, y: 0 }, true)
    }

    // 根部移动辅助
    if (!ko && this.state === 'normal') {
      const hip = this.parts.hip.body
      if (this.rootVelTarget.active) {
        const v = hip.linvel()
        const fx = clamp((this.rootVelTarget.vx - v.x) * 70, -9000, 9000)
        const fy = clamp((this.rootVelTarget.vy - v.y) * 70, -9000, 9000)
        hip.applyImpulse({ x: fx * dt, y: fy * dt }, true)
      }
      if (this.rootForce.fx !== 0 || this.rootForce.fy !== 0) {
        hip.applyImpulse({ x: this.rootForce.fx * dt, y: this.rootForce.fy * dt }, true)
      }
    }
  }

  /** 每帧（各子步之后）调用：清掉单帧有效的扭矩指令 */
  clearFrameCommands(): void {
    for (const m of Object.values(this.motors)) {
      if (m.mode === 'torque')
        m.mode = 'off'
    }
    this.rootForce.fx = 0
    this.rootForce.fy = 0
  }

  private applyJointTorque(parent: RAPIER.RigidBody, child: RAPIER.RigidBody, torque: number, dt: number): void {
    // torque 为模型角方向（增大 wrap(rot2-rot1) = 子体 +，父体 -）
    child.applyTorqueImpulse(torque * dt, true)
    parent.applyTorqueImpulse(-torque * dt, true)
  }

  /** 每步之后：状态机（倒地判定） */
  postStep(dt: number): void {
    if (this.state === 'ko')
      return
    const hip = this.parts.hip.body
    const dev = Math.abs(radToDeg(wrapAngle(hip.rotation() - this.restRot.hip)))
    const t = hip.translation()
    if (dev > 70 || t.y < 40) {
      this.downTimer += dt
      if (this.downTimer > 0.5 && this.state !== 'down')
        this.state = 'down'
    }
    else {
      this.downTimer = 0
      if (this.state === 'down' && dev < CFG.downRecoverAngle)
        this.state = 'normal'
    }
  }

  /** 重置到静止姿态（回合开始） */
  reset(spawnX: number): void {
    for (const [bone, ref] of Object.entries(this.parts)) {
      const def = PARTS[bone]
      const rot = restRotRad(bone, this.facing)
      const [cx, cy] = pivotToCenter(REST_POSE[bone].pivot, rot, def.L)
      ref.body.setTranslation({ x: spawnX + cx, y: cy }, true)
      ref.body.setRotation(rot, true)
      ref.body.setLinvel({ x: 0, y: 0 }, true)
      ref.body.setAngvel(0, true)
    }
    for (const [name, m] of Object.entries(this.motors)) {
      m.mode = 'off'
      m.maxTorque = this.defaultMaxTorque[name]
      const j = JOINTS[name]
      this.semanticLimits[name] = [j.lim[0], j.lim[1]]
      this.jointLimits[name] = this.modelLimits(name)
      this.joints[name].setLimits(this.jointLimits[name][0], this.jointLimits[name][1])
    }
    this.balanceStrength = 1
    this.rootVelTarget.active = false
    this.hp = CFG.maxHp
    this.state = 'normal'
    this.downTimer = 0
    // 传送后同步上一帧位姿，避免渲染插值把角色从旧位置"飞"回来
    this.capturePrev()
  }

  destroy(): void {
    for (const j of Object.values(this.joints)) this.world.removeImpulseJoint(j, true)
    for (const p of Object.values(this.parts)) {
      this.world.removeCollider(p.collider, true)
      this.world.removeRigidBody(p.body)
    }
  }
}
