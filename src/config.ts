/** 全局常量：世界（物理像素坐标，y 轴向上，地面 y=0）、回合、相机等。 */
export const CFG = {
  /** 重力加速度 px/s²（约 100px = 1m 时 ×2.2 手感系数） */
  gravityY: -2200,
  /** 固定物理步长 */
  fixedDt: 1 / 60,
  /** 场地：地面 y=0，左右墙壁 */
  arenaHalfWidth: 950,
  wallHeight: 1000,
  groundExtend: 700, // 地面视觉向外延伸
  ceilingY: 1300,

  /** 相机 */
  viewWorldH: 720, // 纵向基准取景：站立场景覆盖的世界高（角色约占画面高 1/4）
  camMinScale: 0.4,
  camMaxScale: 1.5,
  camLerp: 0.08,
  /** 超宽屏可见世界宽上限（场地 1900 + 两侧余量）：再宽就放大镜头而不是露出场外虚空 */
  maxVisibleW: 2400,

  /** 战斗 */
  maxHp: 100,
  roundTime: 99,
  /** 硬直上限（秒）；实际时长按伤害换算，见 hitstunBase / hitstunPerDmg */
  hitstunTime: 0.35,
  /** 硬直时长 = min(hitstunTime, hitstunBase + 伤害 × hitstunPerDmg) */
  hitstunBase: 0.16,
  hitstunPerDmg: 0.014,
  downRecoverAngle: 30, // deg，倒地后躯干回到该角度内则恢复

  /**
   * 伤害曲线（见 combatSystem.processDamage）：
   * 饱和基 = dmgBaseMax × (F - dmgThreshold) / ((F - dmgThreshold) + dmgHalfScale)，
   * 再 × 打击倍率 × 受伤倍率 × 速度系数 × 格挡系数，四舍五入后夹到 [1, dmgCap]
   * （格挡/防御部位的擦伤可为 0，即完全挡下）。
   */
  /** 接触力阈值：低于此值视为触碰/倚靠，不结算 */
  dmgThreshold: 4200,
  /** 饱和半程：超力 = half 时饱和基达到上限的一半 */
  dmgHalfScale: 7000,
  /** 饱和基上限（乘倍率之前） */
  dmgBaseMax: 6,
  /** 单次命中伤害上限（安全网，杜绝一击必杀） */
  dmgCap: 12,
  /** 抬臂格挡减伤系数 */
  guardMult: 0.35,
  /** 冷却：同一攻击部件对同一角色过去多久才结算一次（秒） */
  dmgCooldown: 0.45,
  /** 受击者全局无敌帧：任何命中后多久内不再受伤（秒，防多肢同帧叠伤） */
  dmgVictimCooldown: 0.12,
  /** 相对速度门槛（px/s）：低于此值视为慢速推挤，不结算 */
  dmgMinSpeed: 180,
  /** 速度系数 = clamp(攻防部件相对速度 / dmgSpeedRef, dmgSpeedMin, dmgSpeedMax) */
  dmgSpeedRef: 900,
  dmgSpeedMin: 0.4,
  dmgSpeedMax: 1.3,
  /** 击退冲量 = min(knockCap, 伤害 × knockPerDmg) */
  knockPerDmg: 110,
  knockCap: 1500,

  /** 角色出生 */
  spawnX: 280,
  /** 髋部（hip 部件中心）静止高度 */
  hipRestY: 84,

  /** 沙箱 */
  workerWatchdogMs: 600,
  maxCommandsPerTick: 500,
  maxLogsPerSecond: 40,
} as const

export type FighterId = 'P1' | 'P2'
