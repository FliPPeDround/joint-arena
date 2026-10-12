export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
export const degToRad = (d: number): number => (d * Math.PI) / 180
export const radToDeg = (r: number): number => (r * 180) / Math.PI
/** 归一化到 (-PI, PI] */
export function wrapAngle(a: number): number {
  a = (a + Math.PI) % (Math.PI * 2)
  if (a <= 0)
    a += Math.PI * 2
  return a - Math.PI
}

/** 物理世界(y向上) → 骨架空间(y向下，facing 镜像由容器完成) */
export function worldToArmature(wx: number, wy: number, facing: 1 | -1): [number, number] {
  return [facing * wx, -wy]
}

/** 物理旋转角(弧度, y向上) → DragonBones/Pixi 显示旋转角(弧度, y向下) */
export function worldRotToDb(rot: number, facing: 1 | -1): number {
  return facing === 1 ? -rot - Math.PI / 2 : rot + Math.PI / 2
}

export interface Vec { x: number, y: number }

/** 线段-线段最近距离（用于 worker 端 raycast 近似） */
export function segSegDistance(p1: Vec, q1: Vec, p2: Vec, q2: Vec): number {
  const d1x = q1.x - p1.x; const d1y = q1.y - p1.y
  const d2x = q2.x - p2.x; const d2y = q2.y - p2.y
  const rx = p1.x - p2.x; const ry = p1.y - p2.y
  const a = d1x * d1x + d1y * d1y
  const e = d2x * d2x + d2y * d2y
  const f = d2x * rx + d2y * ry
  let s = 0; let t = 0
  if (a <= 1e-9 && e <= 1e-9) { return Math.hypot(rx, ry) }
  if (a <= 1e-9) { s = 0; t = clamp01(f / e) }
  else {
    const c = d1x * rx + d1y * ry
    if (e <= 1e-9) { t = 0; s = clamp01(-c / a) }
    else {
      const b = d1x * d2x + d1y * d2y
      const denom = a * e - b * b
      s = denom !== 0 ? clamp01((b * f - c * e) / denom) : 0
      t = (b * s + f) / e
      if (t < 0) { t = 0; s = clamp01(-c / a) }
      else if (t > 1) { t = 1; s = clamp01((b - c) / a) }
    }
  }
  const c1x = p1.x + d1x * s; const c1y = p1.y + d1y * s
  const c2x = p2.x + d2x * t; const c2y = p2.y + d2y * t
  return Math.hypot(c1x - c2x, c1y - c2y)
}
