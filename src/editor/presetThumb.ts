import type { AtlasResult } from '../skeleton/whiteboxAtlas'
import { PART_LIST, REST_POSE } from '../skeleton/partDefs'
import { buildWhiteboxAtlas } from '../skeleton/whiteboxAtlas'

let atlasCache: AtlasResult | null = null
function getAtlas(): AtlasResult {
  atlasCache ??= buildWhiteboxAtlas()
  return atlasCache
}

/** 从预设代码解析 setPartColor(part, '#hex') 的配色（解析不出就用白膜原色） */
function parsePartColors(code: string): Record<string, string> {
  const colors: Record<string, string> = {}
  // part 实参两种写法都认：字符串字面量 'torso' 或统一枚举 sdk.P.TORSO
  const re = /setPartColor\(\s*(?:(['"])(\w+)\1|sdk\.P\.([A-Z_]+))\s*,\s*(['"])([^'"]+)\4\s*\)/g
  for (const m of code.matchAll(re)) {
    const key = (m[2] ?? m[3]?.toLowerCase()) as string
    if (PART_LIST.some(p => p.bone === key))
      colors[key] = m[5]
  }
  return colors
}

/** 图集帧染色缓存：key = bone|color（source-atop 保住白膜的渐变与描边） */
const tintCache = new Map<string, HTMLCanvasElement>()

function tintedFrame(bone: string, color: string): HTMLCanvasElement | null {
  const atlas = getAtlas()
  const frame = atlas.frames[bone]
  if (!frame)
    return null
  const key = `${bone}|${color}`
  let cv = tintCache.get(key)
  if (!cv) {
    cv = document.createElement('canvas')
    cv.width = frame.w
    cv.height = frame.h
    const g = cv.getContext('2d')!
    g.drawImage(atlas.canvas, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h)
    g.globalCompositeOperation = 'source-atop'
    g.globalAlpha = 0.88
    g.fillStyle = color
    g.fillRect(0, 0, frame.w, frame.h)
    tintCache.set(key, cv)
  }
  return cv
}

/**
 * 在缩略图画布上渲染预设的「预设图」：静止姿态的白膜骨架 +
 * 代码里 setPartColor 染上的配色，地面 y=0 落在画布底部附近。
 */
export function renderPresetThumb(cv: HTMLCanvasElement, code: string): void {
  const atlas = getAtlas()
  const g = cv.getContext('2d')!
  const W = cv.width
  const H = cv.height
  g.clearRect(0, 0, W, H)

  const colors = parsePartColors(code)
  // 站立姿态包围盒：x ∈ [-26, 26]，y ∈ [0, 150]
  const s = Math.min(H * 0.84 / 150, W * 0.72 / 52)
  const groundY = H * 0.9
  const cx = W * 0.47
  const sx = (x: number) => cx + x * s
  const sy = (y: number) => groundY - y * s

  // 地面软阴影
  g.save()
  g.globalAlpha = 0.22
  g.fillStyle = '#000'
  g.beginPath()
  g.ellipse(sx(0), groundY + 3 * s, 30 * s, 5 * s, 0, 0, Math.PI * 2)
  g.fill()
  g.restore()

  // 按 z 从低到高绘制（z 大 = 前层）
  const parts = [...PART_LIST].sort((a, b) => a.z - b.z)
  for (const p of parts) {
    const frame = atlas.frames[p.bone]
    if (!frame)
      continue
    const pose = REST_POSE[p.bone]
    const img = colors[p.bone] ? tintedFrame(p.bone, colors[p.bone]) : null
    g.save()
    g.translate(sx(pose.pivot[0]), sy(pose.pivot[1]))
    // 图像 +y（内容延伸方向）对齐部件轴向：世界角 θ → 屏幕角 atan2(-cosθ, -sinθ)
    const rot = (pose.rot * Math.PI) / 180
    g.rotate(Math.atan2(-Math.cos(rot), -Math.sin(rot)))
    const dw = frame.w * s
    const dh = frame.h * s
    if (img)
      g.drawImage(img, -dw / 2, 0, dw, dh)
    else
      g.drawImage(atlas.canvas, frame.x, frame.y, frame.w, frame.h, -dw / 2, 0, dw, dh)
    g.restore()
  }
}
