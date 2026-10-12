import type { AtlasResult } from '../skeleton/whiteboxAtlas'
import type { FighterView } from './fighterView'
import * as PIXI from 'pixi.js'
import { CFG } from '../config'
import { buildWhiteboxAtlas } from '../skeleton/whiteboxAtlas'

export interface CameraState {
  x: number
  y: number
  scale: number
}

/**
 * 场景配色（游戏画布领域数据）：中性暗底与 UI 的 dark 主题（bg-base #111）同源，
 * 绿色取主题 primary-400，玩家侧色与 --ja-p1 / --ja-p2 一致。
 * 光影一律用低透明度白色叠加（与 bg-sunken 的分层思路一致），不再引入蓝灰色相。
 */
const SCENE = {
  base: 0x111111,
  line: 0xFFFFFF,
  accent: 0x7EB267,
  p1Side: 0x4D9FFF,
  p2Side: 0xFF5D7E,
} as const

/** 用 Canvas 2D 生成竖向线性渐变纹理（行 0 = 纹理顶部） */
function linearGradientTex(h: number, stops: Array<[number, string]>, w = 16): PIXI.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 0, h)
  for (const [offset, color] of stops) gradient.addColorStop(offset, color)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)
  return new PIXI.Texture(new PIXI.BaseTexture(canvas))
}

/** 用 Canvas 2D 生成径向渐变纹理（中心白 → 边缘透明），配合 tint / 拉伸做光斑 */
function radialGradientTex(size = 256): PIXI.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return new PIXI.Texture(new PIXI.BaseTexture(canvas))
}

/**
 * 场地内取景中线：中线跟随角色但不让视野滑出场地；
 * 视野比场地还宽时（钳制区间反转）回到场地正中，否则会偏向单侧、场外虚空压向另一侧。
 */
export function arenaCamX(x: number, halfViewW: number): number {
  const lo = -CFG.arenaHalfWidth + halfViewW
  const hi = CFG.arenaHalfWidth - halfViewW
  return lo > hi ? 0 : Math.max(lo, Math.min(hi, x))
}

/** Pixi 应用、场景层级、相机与场地绘制 */
export class GameApp {
  app: PIXI.Application
  camera: PIXI.Container
  /** 角色/骨架层：骨架空间为 y 向下（屏幕系），不参与相机的 y 翻转，仅共享平移缩放 */
  fighterLayer: PIXI.Container
  arenaLayer: PIXI.Container
  fxLayer: PIXI.Container
  debugLayer: PIXI.Container
  atlas: AtlasResult
  atlasTexture: PIXI.Texture
  canvasW = 800; canvasH = 600
  private resizeObserver: ResizeObserver
  private cam: CameraState = { x: 0, y: 0, scale: 1 }
  private camInit = false
  private sparks: { gfx: PIXI.Graphics, t: number, x: number, y: number }[] = []
  private dmgTexts: { holder: PIXI.Container, t: number, life: number, vx: number, vy: number }[] = []

  constructor(canvas: HTMLCanvasElement) {
    this.app = new PIXI.Application({
      view: canvas,
      background: SCENE.base,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    })
    this.camera = new PIXI.Container()
    this.arenaLayer = new PIXI.Container()
    this.fxLayer = new PIXI.Container()
    this.debugLayer = new PIXI.Container()
    this.fighterLayer = new PIXI.Container()
    this.camera.addChild(this.arenaLayer, this.fxLayer, this.debugLayer)
    this.app.stage.addChild(this.camera)
    this.app.stage.addChild(this.fighterLayer)

    this.atlas = buildWhiteboxAtlas()
    const base = new PIXI.BaseTexture(this.atlas.canvas)
    this.atlasTexture = new PIXI.Texture(base)

    this.drawArena()
    this.resize()
    // 画布随 #game-wrap 的实际尺寸重适配：右侧工作区折叠/展开不经过 window resize
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(document.getElementById('game-wrap')!)
  }

  /** 供 FighterView 使用的图集 JSON */
  get atlasJson(): object {
    return this.atlas.atlasJson
  }

  /**
   * 把纹理铺进世界矩形 [x, x+w] × [yBottom, yBottom+h]。
   * 相机对 y 取了负缩放（世界 y 向上），默认 raw 放置会上下镜像，
   * upright = true 时把纹理首行对齐到矩形顶部（屏幕正立），flipX 同理镜像横向。
   */
  private placeTex(
    tex: PIXI.Texture,
    x: number,
    yBottom: number,
    w: number,
    h: number,
    upright = true,
    flipX = false,
  ): PIXI.Sprite {
    const sp = new PIXI.Sprite(tex)
    sp.scale.set((flipX ? -w : w) / tex.width, (upright ? -h : h) / tex.height)
    sp.position.set(flipX ? x + w : x, upright ? yBottom + h : yBottom)
    return sp
  }

  /** 世界的舞台绘制。各渐变层都淡出到透明、底色铺满相机可达范围，任意取景下画布不留空档 */
  private drawArena(): void {
    const { arenaHalfWidth: W, groundExtend: E, wallHeight: H } = CFG

    // 底色：铺满一切相机可达范围
    const base = new PIXI.Graphics()
    base.beginFill(SCENE.base)
    base.drawRect(-W - E - 10000, -10000, (W + E + 10000) * 2, 20000 + CFG.ceilingY)
    base.endFill()
    this.arenaLayer.addChild(base)

    const skyTex = linearGradientTex(512, [[0, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0.06)']])
    const floorTex = linearGradientTex(512, [[0, 'rgba(255,255,255,0.075)'], [1, 'rgba(255,255,255,0)']])
    const fadeTex = linearGradientTex(512, [[0, '#111111'], [1, 'rgba(17,17,17,0)']])
    const edgeTex = linearGradientTex(256, [[0, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0.25)']])
    const rimTex = linearGradientTex(64, [[0, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']])
    const centerTex = linearGradientTex(256, [[0, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0.5)']])
    const glowTex = radialGradientTex()

    // 天幕：地平线附近微微提亮，向上融回底色
    this.arenaLayer.addChild(this.placeTex(skyTex, -W - E, 0, (W + E) * 2, 900))

    // 校准网格（试炼场的“背墙”）：淡淡的白色网格，上端由 fade 层自然收进黑暗
    const grid = new PIXI.Graphics()
    grid.lineStyle(1, SCENE.line, 0.065, 0.5)
    for (let x = -W; x <= W; x += 100) {
      grid.moveTo(x, 0)
      grid.lineTo(x, 800)
    }
    for (let y = 100; y <= 800; y += 100) {
      grid.moveTo(-W, y)
      grid.lineTo(W, y)
    }
    this.arenaLayer.addChild(grid)

    // 墙体（画在 fade 层之前，随高度一起隐入黑暗）
    const walls = new PIXI.Graphics()
    walls.beginFill(SCENE.line, 0.03)
    walls.drawRect(-W - 34, 0, 34, H)
    walls.drawRect(W, 0, 34, H)
    walls.endFill()
    this.arenaLayer.addChild(walls)

    // 高度淡出层：让网格与墙体上端平滑融进底色
    this.arenaLayer.addChild(this.placeTex(fadeTex, -W - E, 0, (W + E) * 2, 1000))

    // 地面：沿线提亮、向下沉入黑暗（“测台”承接灯光的感觉）
    this.arenaLayer.addChild(this.placeTex(floorTex, -W - E, -900, (W + E) * 2, 900))

    // 两侧墙根的玩家色辉光：标记 P1 / P2 半场
    for (const [sx, color] of [[-1, SCENE.p1Side], [1, SCENE.p2Side]] as const) {
      const glow = this.placeTex(glowTex, sx * W - 350, -170, 700, 280)
      glow.tint = color
      glow.alpha = 0.07
      glow.blendMode = PIXI.BLEND_MODES.ADD
      this.arenaLayer.addChild(glow)
    }

    // 地面沿线的品牌绿反光
    const rim = this.placeTex(rimTex, -W, -7, W * 2, 7)
    rim.tint = SCENE.accent
    this.arenaLayer.addChild(rim)

    // 中线：从地面向上淡出的绿色细线
    const center = this.placeTex(centerTex, -1, 0, 2, 300)
    center.tint = SCENE.accent
    center.alpha = 0.6
    this.arenaLayer.addChild(center)

    // 墙内缘的受光边
    this.arenaLayer.addChild(this.placeTex(edgeTex, -W - 3, 0, 3, 900))
    this.arenaLayer.addChild(this.placeTex(edgeTex, W, 0, 3, 900))

    // 地面线：场内亮、场外暗；刻度呼应“可编程”的标定感
    const marks = new PIXI.Graphics()
    marks.lineStyle(3, SCENE.line, 0.34, 0.5)
    marks.moveTo(-W, 0)
    marks.lineTo(W, 0)
    marks.lineStyle(2, SCENE.line, 0.1, 0.5)
    marks.moveTo(-W - E, 0)
    marks.lineTo(-W, 0)
    marks.moveTo(W, 0)
    marks.lineTo(W + E, 0)
    marks.lineStyle(1, SCENE.line, 0.1, 0.5)
    for (let x = -W + 100; x <= W - 100; x += 100) {
      if (x === 0)
        continue
      marks.moveTo(x, 0)
      marks.lineTo(x, -7)
    }
    this.arenaLayer.addChild(marks)

    // 氛围光斑（呼应大厅的装饰光斑）：对角布置，ADD 叠加出舞台灯感
    const blobA = this.placeTex(glowTex, -380 - 800, 180, 1600, 760)
    blobA.alpha = 0.05
    blobA.blendMode = PIXI.BLEND_MODES.ADD
    this.arenaLayer.addChild(blobA)
    const blobB = this.placeTex(glowTex, 430 - 500, 10, 1000, 460)
    blobB.tint = SCENE.accent
    blobB.alpha = 0.065
    blobB.blendMode = PIXI.BLEND_MODES.ADD
    this.arenaLayer.addChild(blobB)
  }

  /**
   * 相机（对战 / 预览制式）：横向居中两角色，地面线静息在画面 78% 高处。
   * 缩放优先级：纵向基准取景（viewWorldH）→ 两人拉开时收视野 → 超宽屏时
   * 放大镜头把可见世界宽压在 maxVisibleW 内 → 有人跳很高时先沉地面线、
   * 仍不够再收缩视野（纵向可见性优先于宽度下限）。
   */
  updateCamera(canvasW: number, canvasH: number, p1x: number, p2x: number, topY: number): void {
    this.canvasW = canvasW; this.canvasH = canvasH
    const baseScale = canvasH / CFG.viewWorldH
    const dx = Math.abs(p1x - p2x)
    const fitX = (canvasW * 0.78) / Math.max(dx, 420)
    let scale = Math.min(baseScale, fitX)
    scale = Math.max(scale, canvasW / CFG.maxVisibleW)
    const fitY = (canvasH * 0.88) / (topY + 140)
    scale = Math.max(CFG.camMinScale, Math.min(scale, fitY, CFG.camMaxScale))
    const cx = arenaCamX((p1x + p2x) / 2, canvasW / 2 / scale)
    const groundRest = canvasH * 0.78
    const camY = Math.min(canvasH * 0.88, Math.max(groundRest, (topY + 140) * scale))
    const lerp = this.camInit ? CFG.camLerp : 1
    this.camInit = true
    this.cam.x += (cx - this.cam.x) * lerp
    this.cam.y += (camY - this.cam.y) * lerp
    this.cam.scale += (scale - this.cam.scale) * lerp
    this.applyCameraTransform(this.cam.x, this.cam.scale, this.cam.y)
  }

  /** 当前镜头取景（场景切换时供引擎把上一制式的取景播种给新制式） */
  get cameraState(): CameraState {
    return { ...this.cam }
  }

  /** 镜头播种：把外部给定的取景设为当前镜头并视为已初始化，后续帧从它开始连续插值 */
  seedCamera(x: number, scale: number, y: number): void {
    this.cam = { x, y, scale }
    this.camInit = true
  }

  /** 应用相机变换：camera 层 y 翻转（世界 y 向上），fighter 层不翻转（骨架空间 y 向下） */
  applyCameraTransform(cx: number, s: number, camY: number): void {
    this.camera.scale.set(s, -s)
    this.camera.position.set(this.canvasW / 2 - cx * s, camY)
    this.fighterLayer.scale.set(s, s)
    this.fighterLayer.position.set(this.canvasW / 2 - cx * s, camY)
  }

  /** 世界坐标 → 画布像素 */
  worldToScreen(wx: number, wy: number): [number, number] {
    const s = this.cam.scale
    return [this.camera.position.x + wx * s, this.camera.position.y - wy * s]
  }

  /** 画布像素 → 世界坐标 */
  screenToWorld(sx: number, sy: number): [number, number] {
    const s = this.cam.scale
    return [(sx - this.camera.position.x) / s, (this.camera.position.y - sy) / s]
  }

  spawnHitSpark(x: number, y: number, color = 0xFFD34D): void {
    const gfx = new PIXI.Graphics()
    gfx.lineStyle(2, color, 1)
    for (let i = 0; i < 7; i++) {
      const a = (Math.PI * 2 * i) / 7 + Math.random() * 0.5
      const r1 = 6 + Math.random() * 6; const r2 = r1 + 7 + Math.random() * 9
      gfx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1)
      gfx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2)
    }
    gfx.position.set(x, y)
    this.fxLayer.addChild(gfx)
    this.sparks.push({ gfx, t: 0.28, x, y })
  }

  /** 伤害数字粒子：从命中点飘起、先放大后回落、淡出；fxLayer 在 y 翻转的相机层里，文字内部再翻一次保持正立 */
  spawnDamageText(x: number, y: number, dmg: number | string, color = 0xFFD34D, crit = false): void {
    const label = new PIXI.Text(String(dmg), {
      fontFamily: 'Arial, "PingFang SC", sans-serif',
      fontSize: crit ? 32 : 24,
      fontWeight: '900',
      fill: color,
      stroke: '#111111',
      strokeThickness: 4,
      letterSpacing: 1,
    })
    label.anchor.set(0.5)
    label.scale.y = -1
    label.resolution = 2
    const holder = new PIXI.Container()
    holder.addChild(label)
    holder.position.set(x + (Math.random() - 0.5) * 14, y + 12)
    holder.alpha = 0
    this.fxLayer.addChild(holder)
    this.dmgTexts.push({
      holder,
      t: 0.8,
      life: 0.8,
      vx: (Math.random() - 0.5) * 40,
      vy: 80 + Math.random() * 40,
    })
  }

  tickFx(dt: number): void {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i]
      sp.t -= dt
      sp.gfx.alpha = Math.max(0, sp.t / 0.28)
      sp.gfx.scale.set(1 + (1 - sp.t / 0.28) * 0.9)
      if (sp.t <= 0) {
        sp.gfx.destroy()
        this.sparks.splice(i, 1)
      }
    }
    for (let i = this.dmgTexts.length - 1; i >= 0; i--) {
      const d = this.dmgTexts[i]
      d.t -= dt
      const k = 1 - d.t / d.life
      d.holder.position.x += d.vx * dt
      d.holder.position.y += d.vy * dt
      d.vy *= Math.max(0, 1 - 3.5 * dt)
      d.holder.scale.set(k < 0.15 ? 1.5 - (k / 0.15) * 0.5 : 1)
      d.holder.alpha = k < 0.08 ? k / 0.08 : (k > 0.55 ? Math.max(0, 1 - (k - 0.55) / 0.45) : 1)
      if (d.t <= 0) {
        d.holder.destroy({ children: true })
        this.dmgTexts.splice(i, 1)
      }
    }
  }

  resize(): void {
    const wrap = document.getElementById('game-wrap')!
    const w = wrap.clientWidth; const h = wrap.clientHeight
    this.app.renderer.resize(w, h)
    this.canvasW = w; this.canvasH = h
  }

  /** 渲染一帧（姿态已由外部同步） */
  render(): void {
    this.app.render()
  }

  addFighterView(view: FighterView): void {
    this.fighterLayer.addChild(view.container as unknown as PIXI.Container)
  }

  /** 释放观察者与渲染器（引擎 dispose 时调用） */
  dispose(): void {
    this.resizeObserver.disconnect()
    this.app.destroy(false, { children: true, texture: true, baseTexture: true })
  }
}
