/** Monaco 里 `sdk` 全局的类型声明（与 workerSdk.ts 的运行时 API 保持一致） */

export const SDK_DTS = `// Joint Arena SDK —— 由游戏运行时注入的全局对象
// 统一部件 key：行动（关节驱动）/ 外观（颜色贴图）/ 传感器全部用同一套部件名。
// 动作作用于该部件绕父部件的旋转，如 P.FOREARM_R = 前臂（弯肘）、P.SHIN_R = 小腿（弯膝）。
declare const sdk: {
  /** 统一部件枚举：sdk.P.TORSO / sdk.P.FOREARM_R … */
  P: {
    readonly HIP: 'hip'
    readonly TORSO: 'torso'
    readonly HEAD: 'head'
    readonly UPPERARM_R: 'upperarm_R'
    readonly FOREARM_R: 'forearm_R'
    readonly HAND_R: 'hand_R'
    readonly UPPERARM_L: 'upperarm_L'
    readonly FOREARM_L: 'forearm_L'
    readonly HAND_L: 'hand_L'
    readonly THIGH_R: 'thigh_R'
    readonly SHIN_R: 'shin_R'
    readonly FOOT_R: 'foot_R'
    readonly THIGH_L: 'thigh_L'
    readonly SHIN_L: 'shin_L'
    readonly FOOT_L: 'foot_L'
  }
  /** 可用部件名列表 */
  PARTS: string[]

  onInit(cb: () => void): void
  onTick(cb: (dt: number) => void): void
  onEvent(cb: (e: unknown) => void): void
  onDestroy(cb: () => void): void

  setJointAngle(part: string, angle: number): void
  rotateJoint(part: string, deltaAngle: number): void
  getJointAngle(part: string): number
  setJointTorque(part: string, torque: number): void
  setJointMotor(part: string, targetAngle: number, speed?: number, maxTorque?: number): void
  setJointLimits(part: string, minAngle: number, maxAngle: number): void

  getBonePosition(part: string): { x: number, y: number }
  getBoneVelocity(part: string): { x: number, y: number }
  getBoneRotation(part: string): number
  getOpponentBonePosition(part: string): { x: number, y: number }
  getContacts(part: string): string[]
  getDistanceTo(target: string): number
  raycast(origin: { x: number, y: number }, direction: { x: number, y: number }, distance: number): {
    hit: boolean
    distance: number
    point: { x: number, y: number }
    part: string
  }

  bindKey(key: string, cb: () => void): void
  bindMouse(button: string | number, cb: (e: { button: number, x: number, y: number }) => void): void
  isKeyDown(key: string): boolean
  isMouseDown(button: string | number): boolean
  getMousePosition(): { x: number, y: number }

  setPartTexture(part: string, textureUrl: string): void
  setPartColor(part: string, color: number | string): void
  setPartTextureFromCanvas(part: string, canvas: OffscreenCanvas): void
  createCanvas(w: number, h: number): OffscreenCanvas
  resetPart(part: string): void
  setPartScale(part: string, scaleX: number, scaleY: number): void
  setPartOffset(part: string, offsetX: number, offsetY: number): void

  log(message: unknown): void
  logWarn(message: unknown): void
  getTime(): number
  getDeltaTime(): number
  getHp(): number
  getOpponentHp(): number
  getSelfState(): { hp: number, state: string, facing: number }
  getOpponentState(): { hp: number, state: string, facing: number, torso: { x: number, y: number } }
  getRoundTime(): number
  setBalanceStrength(v: number): void
  applyRootForce(fx: number, fy: number): void
  setRootVelocity(vx: number, vy: number): void
  stopMoving(): void
}
`
