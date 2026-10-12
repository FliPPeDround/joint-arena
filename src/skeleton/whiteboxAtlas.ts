import { ATLAS_CELL, PART_LIST, PART_PIVOT_UV } from './partDefs'

export const ATLAS_SIZE = 512

export interface AtlasResult {
  canvas: HTMLCanvasElement
  /** DragonBones 图集 JSON（SubTexture 列表，含 pivot） */
  atlasJson: object
  /** 每个部件在图集中的 frame（px） */
  frames: Record<string, { x: number, y: number, w: number, h: number }>
}

function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

function drawPart(g: CanvasRenderingContext2D, bone: string, x: number, y: number, w: number, h: number): void {
  const r = Math.min(w, h) / 2
  // 白膜主体：浅灰 + 描边 + 轻微立体渐变
  const grad = g.createLinearGradient(x, y, x, y + h)
  grad.addColorStop(0, '#f2f4f9')
  grad.addColorStop(0.5, '#e2e6ef')
  grad.addColorStop(1, '#c9cfdd')
  g.fillStyle = grad
  roundRect(g, x, y, w, h, Math.min(r, 7))
  g.fill()
  g.lineWidth = 1.5
  g.strokeStyle = '#6f7789'
  g.stroke()

  if (bone === 'head') {
    // 头部：轴心 = 头顶，内容向下延伸（渲染时与四肢一致朝下再由骨骼旋转让其直立）。
    // 图像 +x 侧 = 角色面朝方向（P1 朝 +x）。
    const cx = x + w / 2
    // 刘海（图像顶边 = 头顶）
    g.fillStyle = '#b7bfd2'
    roundRect(g, x + 1, y + 1, w - 2, 6, 2)
    g.fill()
    // 眼睛
    g.fillStyle = '#39404f'
    g.beginPath(); g.arc(cx - 4.5, y + h * 0.42, 1.6, 0, Math.PI * 2); g.fill()
    g.beginPath(); g.arc(cx + 4.5, y + h * 0.42, 1.6, 0, Math.PI * 2); g.fill()
    // 鼻子（面朝侧：图像 +x 方向）
    g.fillRect(cx + 3.5, y + h * 0.52, 3, 1.4)
    // 嘴
    g.fillRect(cx - 3, y + h * 0.62, 6, 1.2)
  }
  else if (bone === 'torso') {
    // 胸口标线
    g.strokeStyle = '#aab2c5'
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(x + w * 0.25, y + h * 0.3); g.lineTo(x + w * 0.75, y + h * 0.3)
    g.stroke()
  }
  else if (bone === 'hand' || bone === 'foot') {
    // 手/脚加一点指节/鞋头示意
    g.strokeStyle = '#aab2c5'
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(x + w * 0.45, y + h * 0.55); g.lineTo(x + w * 0.45, y + h * 0.85)
    g.stroke()
  }
}

/** 生成白膜图集（运行时 canvas 绘制）+ DragonBones 图集 JSON */
export function buildWhiteboxAtlas(): AtlasResult {
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_SIZE
  canvas.height = ATLAS_SIZE
  const g = canvas.getContext('2d')!
  g.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE)

  const frames: Record<string, { x: number, y: number, w: number, h: number }> = {}
  const cells = Math.ceil(Math.sqrt(PART_LIST.length))
  const cell = ATLAS_CELL
  PART_LIST.forEach((p, i) => {
    const cx = (i % cells) * cell
    const cy = Math.floor(i / cells) * cell
    const w = p.W; const h = p.L
    const x = cx + Math.floor((cell - w) / 2)
    const y = cy
    drawPart(g, p.bone, x, y, w, h)
    frames[p.bone] = { x, y, w, h }
  })

  const subTextures = PART_LIST.map((p) => {
    const f = frames[p.bone]
    return {
      name: p.bone,
      x: f.x,
      y: f.y,
      width: f.w,
      height: f.h,
      pivotX: PART_PIVOT_UV[0] * f.w, // 内容顶边中点
      pivotY: PART_PIVOT_UV[1] * f.h,
    }
  })

  const atlasJson = {
    width: ATLAS_SIZE,
    height: ATLAS_SIZE,
    scale: 1,
    SubTexture: subTextures,
  }

  return { canvas, atlasJson, frames }
}

/** 纹理模板：给玩家的部件画布规格（4× 分辨率便于手绘细节） */
export const TEMPLATE_SCALE = 4

export interface PartTemplate {
  part: string
  /** 逻辑像素（= 部件 L×W） */
  lw: number
  lh: number
  /** 画布像素（4×） */
  cw: number
  ch: number
  /** 锚点在画布中的像素位置（顶边中点） */
  px: number
  py: number
}

export function partTemplate(bone: string): PartTemplate {
  const p = PART_LIST.find(x => x.bone === bone)!
  return {
    part: bone,
    lw: p.W,
    lh: p.L,
    cw: p.W * TEMPLATE_SCALE,
    ch: p.L * TEMPLATE_SCALE,
    px: (p.W * TEMPLATE_SCALE) / 2,
    py: 0,
  }
}
