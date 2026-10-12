/**
 * 白膜骨架定义 — 部件（骨骼/插槽/物理刚体三合一）、关节、静止姿态。
 *
 * 坐标约定：
 *  - 物理世界：像素坐标，y 轴向上，地面 y=0，x 轴向右为正。
 *  - 部件局部坐标系：部件轴 = 局部 +X（从轴心指向末端），局部 +Y 为轴左侧 90°。
 *    刚体中心 = 轴心 + R(restRot)·(L/2, 0)，即轴心在刚体局部 (-L/2, 0)。
 *  - 静止角 restRot（世界系逆时针，度）：大部分部件朝下 = -90；
 *    head 朝上 = +90；foot 朝面朝方向 = 0（P1）。
 *
 * 渲染：所有部件贴图在图集里竖直绘制（内容向下延伸），锚点 = 内容顶边中点。
 * facing = -1 时整体容器镜像，foot 静止角取 180°。
 */

/**
 * 部位三分类（命中结算规则）：
 *  - attack 攻击部位：双手双脚，唯一能造成伤害的部件（打到对方防御/受击部位才结算）；
 *  - defense 防御部位：手臂（大臂+前臂）与小腿，被打中只受 0.1 倍伤害（格挡用）；
 *  - vulnerable 受击部位：头 / 身体 / 屁股 / 大腿，伤害按 hurtMult 递减。
 */
export type PartRole = 'attack' | 'defense' | 'vulnerable'

export interface PartDef {
  /** 骨骼名 = 贴图名（图集 SubTexture name） */
  bone: string
  /** 插槽名（bone + '_slot'，与任务书插槽命名一致） */
  slot: string
  /** 轴向长度（轴心 → 末端） */
  L: number
  /** 横向宽度 */
  W: number
  /** 渲染层级（slot z，越大越靠前） */
  z: number
  /** 目标质量（kg，由代码换算成 Rapier 密度） */
  mass: number
  /** 部位分类（命中结算规则，见 PartRole 注释） */
  role: PartRole
  /** 被击中时受伤倍率：受击部位按 头2.0 > 身体1.0 > 屁股0.8 > 大腿0.6，防御部位固定 0.1 */
  hurtMult: number
  /** 击打他人时伤害倍率（>0 = 攻击部位；0 = 不能造成伤害） */
  strikeMult: number
  /** 开启 CCD 防止高速穿模（手/脚等打击部件） */
  ccd: boolean
  /** 碰撞体相对部件中心的偏移（脚跟需要向后延伸，保证踝在支撑面内） */
  colliderOffset?: [number, number]
}

export interface JointDef {
  /** SDK 关节名 */
  joint: string
  /** 父部件（骨骼名） */
  parent: string
  /** 子部件 */
  child: string
  /** 父刚体局部锚点 */
  a1: [number, number]
  /** 子刚体局部锚点 */
  a2: [number, number]
  /** 语义角度限位 [min, max]（度，0 = 静止姿态） */
  lim: [number, number]
  /** 方向号：rapierAngle = dir * facing * semanticAngle */
  dir: 1 | -1
}

function P(bone: string, L: number, W: number, z: number, mass: number, role: PartRole, hurtMult: number, strikeMult: number, ccd = false): PartDef {
  return { bone, slot: `${bone}_slot`, L, W, z, mass, role, hurtMult, strikeMult, ccd }
}

export const PART_LIST: PartDef[] = [
  // 受击部位：头(2.0) > 身体(1.0) > 屁股(0.8) > 大腿(0.6)
  P('hip', 16, 22, 7, 0.90, 'vulnerable', 0.8, 0),
  P('torso', 36, 24, 8, 1.20, 'vulnerable', 1.0, 0),
  P('head', 22, 20, 9, 0.50, 'vulnerable', 2.0, 0),
  // 防御部位：手臂 + 小腿，受伤 0.1 倍（格挡），不能造成伤害
  P('upperarm_R', 28, 8, 13, 0.22, 'defense', 0.1, 0, true),
  P('forearm_R', 26, 7, 14, 0.18, 'defense', 0.1, 0, true),
  P('hand_R', 10, 8, 15, 0.08, 'attack', 0.1, 1.5, true),
  P('upperarm_L', 28, 8, 4, 0.22, 'defense', 0.1, 0, true),
  P('forearm_L', 26, 7, 5, 0.18, 'defense', 0.1, 0, true),
  P('hand_L', 10, 8, 6, 0.08, 'attack', 0.1, 1.5, true),
  P('thigh_R', 36, 10, 10, 0.36, 'vulnerable', 0.6, 0),
  P('shin_R', 34, 8, 11, 0.27, 'defense', 0.1, 0, true),
  P('foot_R', 18, 12, 12, 0.19, 'attack', 0.1, 1.2, true),
  P('thigh_L', 36, 10, 1, 0.36, 'vulnerable', 0.6, 0),
  P('shin_L', 34, 8, 2, 0.27, 'defense', 0.1, 0, true),
  P('foot_L', 18, 12, 3, 0.19, 'attack', 0.1, 1.2, true),
]

// 脚跟向后延伸：踝关节落在支撑面内（站立稳定性关键）
PART_LIST.find(p => p.bone === 'foot_R')!.colliderOffset = [-4, 0]
PART_LIST.find(p => p.bone === 'foot_L')!.colliderOffset = [-4, 0]
export const PARTS: Record<string, PartDef> = Object.fromEntries(
  PART_LIST.map(p => [p.bone, p]),
)

/** 三类部位名清单（调试可视化 / 文档用） */
export const ATTACK_PARTS = PART_LIST.filter(p => p.role === 'attack').map(p => p.bone)
export const DEFENSE_PARTS = PART_LIST.filter(p => p.role === 'defense').map(p => p.bone)
export const VULNERABLE_PARTS = PART_LIST.filter(p => p.role === 'vulnerable').map(p => p.bone)

export const JOINT_LIST: JointDef[] = [
  { joint: 'spine', parent: 'hip', child: 'torso', a1: [-8, 0], a2: [18, 0], lim: [-30, 30], dir: 1 },
  { joint: 'neck', parent: 'torso', child: 'head', a1: [-18, 0], a2: [11, 0], lim: [-45, 45], dir: 1 },
  { joint: 'shoulder_R', parent: 'torso', child: 'upperarm_R', a1: [-14, 11], a2: [-14, 0], lim: [-40, 170], dir: 1 },
  { joint: 'elbow_R', parent: 'upperarm_R', child: 'forearm_R', a1: [14, 0], a2: [-13, 0], lim: [0, 150], dir: 1 },
  { joint: 'wrist_R', parent: 'forearm_R', child: 'hand_R', a1: [13, 0], a2: [-5, 0], lim: [-45, 45], dir: 1 },
  { joint: 'shoulder_L', parent: 'torso', child: 'upperarm_L', a1: [-14, -11], a2: [-14, 0], lim: [-40, 170], dir: 1 },
  { joint: 'elbow_L', parent: 'upperarm_L', child: 'forearm_L', a1: [14, 0], a2: [-13, 0], lim: [0, 150], dir: 1 },
  { joint: 'wrist_L', parent: 'forearm_L', child: 'hand_L', a1: [13, 0], a2: [-5, 0], lim: [-45, 45], dir: 1 },
  { joint: 'hip_R', parent: 'hip', child: 'thigh_R', a1: [8, 8], a2: [-18, 0], lim: [-45, 130], dir: 1 },
  { joint: 'knee_R', parent: 'thigh_R', child: 'shin_R', a1: [18, 0], a2: [-17, 0], lim: [0, 150], dir: -1 },
  { joint: 'ankle_R', parent: 'shin_R', child: 'foot_R', a1: [17, 0], a2: [-9, 0], lim: [-45, 45], dir: 1 },
  { joint: 'hip_L', parent: 'hip', child: 'thigh_L', a1: [8, -8], a2: [-18, 0], lim: [-45, 130], dir: 1 },
  { joint: 'knee_L', parent: 'thigh_L', child: 'shin_L', a1: [18, 0], a2: [-17, 0], lim: [0, 150], dir: -1 },
  { joint: 'ankle_L', parent: 'shin_L', child: 'foot_L', a1: [17, 0], a2: [-9, 0], lim: [-45, 45], dir: 1 },
]

export const JOINTS: Record<string, JointDef> = Object.fromEntries(
  JOINT_LIST.map(j => [j.joint, j]),
)

/**
 * 部件 → 驱动它的关节（该部件相对父部件旋转，即 child === 该部件的关节）。
 * SDK 对外统一用部件 key（行动 / 外观 / 传感器同一套名字），关节名只作旧代码兼容。
 * hip 是根部件，没有驱动关节。
 */
export const JOINT_BY_PART: Record<string, JointDef> = Object.fromEntries(
  JOINT_LIST.map(j => [j.child, j]),
)

export interface RestPose {
  /** 部件轴心（静止时世界坐标） */
  pivot: [number, number]
  /** 静止角（度） */
  rot: number
}

/**
 * 静止姿态（facing=1 参考系；facing=-1 时仅 foot 旋转 180°）
 *  注意：head 的轴心在头顶、轴朝下（与四肢一致），使 neck 关节静止相对角为 0，
 *  远离 Rapier 模型角 ±π 卷绕边界（否则限位失效）。
 */
export const REST_POSE: Record<string, RestPose> = {
  hip: { pivot: [0, 92], rot: -90 },
  torso: { pivot: [0, 128], rot: -90 },
  head: { pivot: [0, 150], rot: -90 },
  upperarm_R: { pivot: [11, 124], rot: -90 },
  forearm_R: { pivot: [11, 96], rot: -90 },
  hand_R: { pivot: [11, 70], rot: -90 },
  upperarm_L: { pivot: [-11, 124], rot: -90 },
  forearm_L: { pivot: [-11, 96], rot: -90 },
  hand_L: { pivot: [-11, 70], rot: -90 },
  thigh_R: { pivot: [8, 76], rot: -90 },
  shin_R: { pivot: [8, 40], rot: -90 },
  foot_R: { pivot: [8, 6], rot: 0 },
  thigh_L: { pivot: [-8, 76], rot: -90 },
  shin_L: { pivot: [-8, 40], rot: -90 },
  foot_L: { pivot: [-8, 6], rot: 0 },
}

/** DragonBones 层级（仅渲染父子关系，物理无关） */
export const DB_PARENT: Record<string, string | null> = {
  root: null,
  hip: 'root',
  torso: 'hip',
  head: 'torso',
  upperarm_R: 'torso',
  forearm_R: 'upperarm_R',
  hand_R: 'forearm_R',
  upperarm_L: 'torso',
  forearm_L: 'upperarm_L',
  hand_L: 'forearm_L',
  thigh_R: 'hip',
  shin_R: 'thigh_R',
  foot_R: 'shin_R',
  thigh_L: 'hip',
  shin_L: 'thigh_L',
  foot_L: 'shin_L',
}

export const ALL_BONES = ['root', ...PART_LIST.map(p => p.bone)]
export const ALL_JOINTS = JOINT_LIST.map(j => j.joint)

/** 玩家可控部件（纹理/缩放/偏移），root 不算 */
export const ALL_PARTS = PART_LIST.map(p => p.bone)

/** 图集单元尺寸与内容锚点（内容 = 部件实际像素大小，水平居中、顶边贴 frame 顶） */
export const ATLAS_CELL = 128
export const PART_PIVOT_UV: [number, number] = [0.5, 0] // 相对 frame 的归一化锚点

export function restRotRad(bone: string, facing: 1 | -1): number {
  const deg = REST_POSE[bone].rot + (bone.startsWith('foot') && facing === -1 ? 180 : 0)
  return (deg * Math.PI) / 180
}

/** 部件轴心（局部 -L/2）→ 刚体中心世界坐标 */
export function pivotToCenter(pivot: [number, number], rotRad: number, L: number): [number, number] {
  return [pivot[0] + Math.cos(rotRad) * (L / 2), pivot[1] + Math.sin(rotRad) * (L / 2)]
}
