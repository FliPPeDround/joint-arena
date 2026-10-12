import type { FighterBody } from '../physics/fighterBody'
import * as PIXI from 'pixi.js'
import { JOINT_LIST, PARTS } from '../skeleton/partDefs'

export interface DebugRay {
  ox: number
  oy: number
  dx: number
  dy: number
  dist: number
  hit: boolean
  hx?: number
  hy?: number
  ttl: number
}

export interface DebugToggles {
  colliders: boolean
  joints: boolean
  bones: boolean
  rays: boolean
}

const COLORS = { p1: 0x4D9FFF, p2: 0xFF5D7E, static: 0x8A93A8, ray: 0x7DFF9B }

/** 骨骼 / 关节 / 碰撞体 / 射线 可视化调试层 */
export class DebugView {
  gfx = new PIXI.Graphics()
  rays: DebugRay[] = []
  private enabled: DebugToggles = { colliders: true, joints: true, bones: false, rays: true }

  constructor(layer: PIXI.Container) {
    layer.addChild(this.gfx)
  }

  setEnabled(t: Partial<DebugToggles>): void {
    Object.assign(this.enabled, t)
  }

  isEnabled(): DebugToggles {
    return { ...this.enabled }
  }

  addRay(r: Omit<DebugRay, 'ttl'>): void {
    this.rays.push({ ...r, ttl: 0.15 })
    if (this.rays.length > 40)
      this.rays.shift()
  }

  draw(p1: FighterBody, p2: FighterBody): void {
    const g = this.gfx
    g.clear()
    if (this.enabled.bones) {
      this.drawFighterBones(g, p1, COLORS.p1)
      this.drawFighterBones(g, p2, COLORS.p2)
    }
    if (this.enabled.colliders) {
      this.drawFighterColliders(g, p1, COLORS.p1)
      this.drawFighterColliders(g, p2, COLORS.p2)
    }
    if (this.enabled.joints) {
      this.drawFighterJoints(g, p1, COLORS.p1)
      this.drawFighterJoints(g, p2, COLORS.p2)
    }
    if (this.enabled.rays) {
      for (const r of this.rays) {
        g.lineStyle(1.5, COLORS.ray, 0.9)
        g.moveTo(r.ox, r.oy)
        if (r.hit)
          g.lineTo(r.hx!, r.hy!)
        else g.lineTo(r.ox + r.dx * r.dist, r.oy + r.dy * r.dist)
        if (r.hit) {
          g.lineStyle(0)
          g.beginFill(COLORS.ray, 0.9)
          g.drawCircle(r.hx!, r.hy!, 3)
          g.endFill()
        }
      }
    }
  }

  tick(dt: number): void {
    for (let i = this.rays.length - 1; i >= 0; i--) {
      this.rays[i].ttl -= dt
      if (this.rays[i].ttl <= 0)
        this.rays.splice(i, 1)
    }
  }

  /** 骨骼线：部件轴心 → 末端的连线 + 轴心节点 */
  private drawFighterBones(g: PIXI.Graphics, f: FighterBody, color: number): void {
    for (const [bone, def] of Object.entries(PARTS)) {
      const body = f.parts[bone].body
      const t = body.translation()
      const r = body.rotation()
      const px = t.x + Math.cos(r) * (-def.L / 2)
      const py = t.y + Math.sin(r) * (-def.L / 2)
      const ex = px + Math.cos(r) * def.L
      const ey = py + Math.sin(r) * def.L
      g.lineStyle(2.5, color, 0.9)
      g.moveTo(px, py)
      g.lineTo(ex, ey)
      g.lineStyle(0)
      g.beginFill(color, 0.95)
      g.drawCircle(px, py, 1.8)
      g.endFill()
    }
  }

  private drawFighterColliders(g: PIXI.Graphics, f: FighterBody, color: number): void {
    g.lineStyle(1.2, color, 0.85)
    for (const [bone, def] of Object.entries(PARTS)) {
      const body = f.parts[bone].body
      const t = body.translation()
      const r = body.rotation()
      const ox = def.colliderOffset?.[0] ?? 0; const oy = def.colliderOffset?.[1] ?? 0
      const c = Math.cos(r); const s = Math.sin(r)
      const hl = def.L / 2; const hw = def.W / 2
      const cx0 = t.x + c * ox - s * oy; const cy0 = t.y + s * ox + c * oy
      const pts: [number, number][] = [
        [cx0 + c * hl - s * hw, cy0 + s * hl + c * hw],
        [cx0 + c * hl + s * hw, cy0 + s * hl - c * hw],
        [cx0 - c * hl + s * hw, cy0 - s * hl - c * hw],
        [cx0 - c * hl - s * hw, cy0 - s * hl + c * hw],
      ]
      g.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < 4; i++) g.lineTo(pts[i][0], pts[i][1])
      g.closePath()
    }
  }

  private drawFighterJoints(g: PIXI.Graphics, f: FighterBody, color: number): void {
    for (const j of JOINT_LIST) {
      const parent = f.parts[j.parent].body
      const t = parent.translation()
      const r = parent.rotation()
      const c = Math.cos(r); const s = Math.sin(r)
      const jx = t.x + c * j.a1[0] - s * j.a1[1]
      const jy = t.y + s * j.a1[0] + c * j.a1[1]
      g.lineStyle(0)
      g.beginFill(color, 0.95)
      g.drawCircle(jx, jy, 2.6)
      g.endFill()
      // 关节角指示：子部件轴方向短线
      const child = f.parts[j.child].body
      const cr = child.rotation()
      g.lineStyle(1.4, color, 0.5)
      g.moveTo(jx, jy)
      g.lineTo(jx + Math.cos(cr) * 14, jy + Math.sin(cr) * 14)
    }
  }
}
