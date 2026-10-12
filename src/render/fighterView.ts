import type { FighterBody } from '../physics/fighterBody'
import type { DBArmatureDisplay, DBFactory } from '../types/dragonBonesApi'
import * as PIXI from 'pixi.js'
import { degToRad, worldRotToDb, wrapAngle } from '../core/utils'
import { SdkError } from '../sdk/sdkError'; import { JOINTS, PART_PIVOT_UV, PARTS, REST_POSE, restRotRad } from '../skeleton/partDefs'
import { buildSkeletonJSON } from '../skeleton/skeletonData'

export interface PartPose {
  /** 轴心世界坐标（y 向上） */
  px: number
  py: number
  /** 部件轴世界角（弧度，y 向上） */
  rot: number
}

interface PartVisualState {
  color: number | null
  texture: PIXI.Texture | null
  scale: [number, number]
  offset: [number, number] // 沿轴 ox / 朝向 oy
}

/**
 * 角色视图：DragonBones 骨架（骨架数据 / 插槽 / 图集由 DB 运行时管理）+ 姿态同步。
 *
 * 同步公式（世界 y 向上 → 骨架空间 y 向下；facing=-1 时容器 scale.x 镜像）：
 *   ax = facing * wx ; ay = -wy
 *   dbRot = facing===1 ? -θ - 90° : θ + 90°
 * 每帧把姿态同时写入 DB 骨骼 offset（数据一致性/调试）和插槽显示对象（实际渲染）。
 */
export class FighterView {
  readonly id: 'P1' | 'P2'
  readonly facing: 1 | -1
  readonly container: DBArmatureDisplay
  sprites: Record<string, PIXI.Sprite> = {}
  private defaultTextures: Record<string, PIXI.Texture> = {}
  private visual: Record<string, PartVisualState> = {}
  private factory: DBFactory
  private restRel: Record<string, number> = {}

  constructor(factory: DBFactory, atlasTexture: PIXI.Texture, atlasJson: object, id: 'P1' | 'P2', facing: 1 | -1) {
    this.factory = factory
    this.id = id
    this.facing = facing
    const armatureName = `fighter_${id}`

    factory.parseDragonBonesData(buildSkeletonJSON(armatureName) as object, armatureName)
    factory.parseTextureAtlasData(atlasJson, atlasTexture, armatureName)
    const display = factory.buildArmatureDisplay(armatureName, armatureName)!
    this.container = display
    this.container.scale.x = facing

    for (const bone of Object.keys(PARTS)) {
      const slotName = PARTS[bone].slot
      const slot = display.armature.getSlot(slotName)
      if (!slot)
        throw new SdkError('slotMissing', { slot: slotName })
      const spr = (slot.display ?? (slot as unknown as { _renderDisplay: PIXI.Sprite })._renderDisplay) as PIXI.Sprite
      if (!spr || !(spr instanceof PIXI.Sprite))
        throw new SdkError('displayMissing', { bone })
      spr.anchor.set(PART_PIVOT_UV[0], PART_PIVOT_UV[1])
      this.sprites[bone] = spr
      this.defaultTextures[bone] = spr.texture
      this.visual[bone] = { color: null, texture: null, scale: [1, 1], offset: [0, 0] }
    }

    // FK 用：静止相对角（弧度）
    for (const [name, j] of Object.entries(JOINTS)) {
      this.restRel[name] = wrapAngle(restRotRad(j.child, facing) - restRotRad(j.parent, facing))
    }
  }

  /** 应用一套部件姿态（物理同步与 M0 演示共用） */
  applyPose(poses: Record<string, PartPose>): void {
    const f = this.facing
    for (const bone of Object.keys(PARTS)) {
      const pose = poses[bone]
      if (!pose)
        continue
      const vs = this.visual[bone]
      // 轴心（含玩家自定义偏移：ox 沿部件轴、oy 朝向面）
      const cos = Math.cos(pose.rot); const sin = Math.sin(pose.rot)
      const px = pose.px + cos * vs.offset[0] - sin * (vs.offset[1] * f)
      const py = pose.py + sin * vs.offset[0] + cos * (vs.offset[1] * f)
      const ax = f * px; const ay = -py
      const dbRot = worldRotToDb(pose.rot, f)
      const base = vs.texture ? 0.25 : 1 // 自定义贴图为 4× 模板分辨率
      const spr = this.sprites[bone]
      spr.position.set(ax, ay)
      spr.rotation = dbRot
      spr.scale.set(base * vs.scale[0], base * vs.scale[1])

      const boneObj = this.container.armature.getBone(bone)
      if (boneObj)
        boneObj.offset.rotation = dbRot
    }
  }

  /** 物理 → 姿态（applyPose 需要部件轴心坐标） */
  poseFromBody(body: FighterBody): Record<string, PartPose> {
    const poses: Record<string, PartPose> = {}
    for (const [bone, def] of Object.entries(PARTS)) {
      const t = body.parts[bone].body.translation()
      const r = body.parts[bone].body.rotation()
      poses[bone] = {
        px: t.x + Math.cos(r) * (-def.L / 2),
        py: t.y + Math.sin(r) * (-def.L / 2),
        rot: r,
      }
    }
    return poses
  }

  /**
   * 固定时间步之间的渲染插值：在上一物理步位姿与当前位姿之间按 alpha 混合
   * （位置线性插值，角度走最短弧）。alpha = 累加器剩余时间 / 固定步长 ∈ [0,1)。
   */
  poseInterpolated(body: FighterBody, alpha: number): Record<string, PartPose> {
    const poses: Record<string, PartPose> = {}
    for (const [bone, def] of Object.entries(PARTS)) {
      const ref = body.parts[bone]
      const t = ref.body.translation()
      const r = ref.body.rotation()
      const prev = body.prevState[bone] ?? { x: t.x, y: t.y, rot: r }
      const rot = prev.rot + wrapAngle(r - prev.rot) * alpha
      const cos = Math.cos(rot); const sin = Math.sin(rot)
      poses[bone] = {
        px: prev.x + (t.x - prev.x) * alpha + cos * (-def.L / 2),
        py: prev.y + (t.y - prev.y) * alpha + sin * (-def.L / 2),
        rot,
      }
    }
    return poses
  }

  /** M0 演示：无物理，由关节角正弦驱动（验证 DragonBones 渲染管线 + 同步数学） */
  demoDrivePose(time: number): Record<string, PartPose> {
    const f = this.facing
    const wave = (freq: number, amp: number, phase = 0) => Math.sin(time * freq + phase) * amp
    const A: Record<string, number> = { // 语义关节角（度）
      spine: wave(1.3, 4),
      neck: wave(2.1, 8),
      shoulder_R: 25 + wave(2.6, 60),
      elbow_R: 45 + wave(2.6, 35, 0.9),
      shoulder_L: 25 + wave(2.6, 60, Math.PI),
      elbow_L: 45 + wave(2.6, 35, 0.9 + Math.PI),
      hip_R: 12 + wave(1.8, 16),
      knee_R: 18 + wave(1.8, 22, 1.1),
      hip_L: 12 + wave(1.8, 16, Math.PI),
      knee_L: 18 + wave(1.8, 22, 1.1 + Math.PI),
      ankle_R: wave(1.8, 10, 0.5),
      ankle_L: wave(1.8, 10, 0.5 + Math.PI),
      wrist_R: 0,
      wrist_L: 0,
    }
    const d = (j: string) => JOINTS[j].dir * f * degToRad(A[j] ?? 0)

    const poses: Record<string, PartPose> = {}
    const hipPivot: [number, number] = [0, REST_POSE.hip.pivot[1] + wave(1.8, 3)]
    const thHip = restRotRad('hip', f)
    poses.hip = { px: hipPivot[0], py: hipPivot[1], rot: thHip }

    const anchor = (pivot: [number, number], rot: number, local: [number, number], L: number): [number, number] => {
      // 关节锚点以刚体质心为原点 → 相对轴心偏移 local + (L/2, 0)
      const lx = local[0] + L / 2; const ly = local[1]
      const c = Math.cos(rot); const s = Math.sin(rot)
      return [pivot[0] + c * lx - s * ly, pivot[1] + s * lx + c * ly]
    }

    // spine
    const jSpine = JOINTS.spine
    const spineBase = anchor(hipPivot, thHip, jSpine.a1, PARTS.hip.L)
    const thTorso = thHip + this.restRel.spine + d('spine')
    const torsoPivot: [number, number] = [spineBase[0] - Math.cos(thTorso) * PARTS.torso.L, spineBase[1] - Math.sin(thTorso) * PARTS.torso.L]
    poses.torso = { px: torsoPivot[0], py: torsoPivot[1], rot: thTorso }

    // neck + head（head 轴心在头顶 = 颈点沿头轴反方向延伸 L）
    const thHead = thTorso + this.restRel.neck + d('neck')
    poses.head = {
      px: torsoPivot[0] - Math.cos(thHead) * PARTS.head.L,
      py: torsoPivot[1] - Math.sin(thHead) * PARTS.head.L,
      rot: thHead,
    }

    // 手臂
    for (const S of ['R', 'L'] as const) {
      const jSh = JOINTS[`shoulder_${S}`]
      const sh = anchor(torsoPivot, thTorso, jSh.a1, PARTS.torso.L)
      const thUa = thTorso + this.restRel[`shoulder_${S}`] + d(`shoulder_${S}`)
      poses[`upperarm_${S}`] = { px: sh[0], py: sh[1], rot: thUa }
      const el = anchor(sh, thUa, JOINTS[`elbow_${S}`].a1, PARTS[`upperarm_${S}`].L)
      const thFa = thUa + this.restRel[`elbow_${S}`] + d(`elbow_${S}`)
      poses[`forearm_${S}`] = { px: el[0], py: el[1], rot: thFa }
      const wr = anchor(el, thFa, JOINTS[`wrist_${S}`].a1, PARTS[`forearm_${S}`].L)
      const thHa = thFa + this.restRel[`wrist_${S}`] + d(`wrist_${S}`)
      poses[`hand_${S}`] = { px: wr[0], py: wr[1], rot: thHa }
    }
    // 腿
    for (const S of ['R', 'L'] as const) {
      const jHip = JOINTS[`hip_${S}`]
      const hj = anchor(hipPivot, thHip, jHip.a1, PARTS.hip.L)
      const thTh = thHip + this.restRel[`hip_${S}`] + d(`hip_${S}`)
      poses[`thigh_${S}`] = { px: hj[0], py: hj[1], rot: thTh }
      const kn = anchor(hj, thTh, JOINTS[`knee_${S}`].a1, PARTS[`thigh_${S}`].L)
      const thSh = thTh + this.restRel[`knee_${S}`] + d(`knee_${S}`)
      poses[`shin_${S}`] = { px: kn[0], py: kn[1], rot: thSh }
      const an = anchor(kn, thSh, JOINTS[`ankle_${S}`].a1, PARTS[`shin_${S}`].L)
      const thFt = thSh + this.restRel[`ankle_${S}`] + d(`ankle_${S}`)
      poses[`foot_${S}`] = { px: an[0], py: an[1], rot: thFt }
    }
    return poses
  }

  /** ---------------- 纹理与外观（SDK 命令落地点） ---------------- */
  private assertPart(part: string): void {
    if (!this.sprites[part])
      throw new SdkError('unknownPart', { name: part, parts: Object.keys(PARTS).join(', ') })
  }

  setPartColor(part: string, color: number | string): void {
    this.assertPart(part)
    const n = typeof color === 'string' ? Number.parseInt(color.replace('#', ''), 16) : color
    if (!Number.isFinite(n))
      throw new SdkError('colorFormat', { color: String(color) })
    this.visual[part].color = n
    this.sprites[part].tint = n
  }

  setPartTexture(part: string, tex: PIXI.Texture): void {
    this.assertPart(part)
    this.visual[part].texture = tex
    this.sprites[part].texture = tex
  }

  resetPart(part: string): void {
    this.assertPart(part)
    const v = this.visual[part]
    v.color = null; v.texture = null; v.scale = [1, 1]; v.offset = [0, 0]
    const spr = this.sprites[part]
    spr.texture = this.defaultTextures[part]
    spr.tint = 0xFFFFFF
    spr.scale.set(1, 1)
  }

  setPartScale(part: string, sx: number, sy: number): void {
    this.assertPart(part)
    this.visual[part].scale = [sx, sy]
  }

  setPartOffset(part: string, ox: number, oy: number): void {
    this.assertPart(part)
    this.visual[part].offset = [ox, oy]
  }

  currentTint(part: string): number {
    return this.visual[part]?.color ?? 0xFFFFFF
  }

  defaultTexture(part: string): PIXI.Texture {
    return this.defaultTextures[part]
  }

  /** 调试：读取当前精灵变换与姿态（供 __JA 钩子使用） */
  renderDbgPublic(): unknown {
    const pick: Record<string, string> = {}
    for (const b of ['hip', 'torso', 'head', 'foot_R']) {
      const s = this.sprites[b]
      pick[b] = `spr(${Math.round(s.position.x)},${Math.round(s.position.y)},r=${Math.round((s.rotation * 180) / Math.PI)})`
    }
    return pick
  }

  destroy(): void {
    this.factory.clock.remove(this.container)
    this.container.destroy({ children: true })
  }
}
