import type { AtlasFrame } from '../stores/game'
// @env browser
import { t } from '../i18n'
import { partTemplate, TEMPLATE_SCALE } from '../skeleton/whiteboxAtlas'

/** 图集帧缺失时也要给出的规格说明：模板画布尺寸 / 逻辑尺寸 / 锚点位置 */
function templateInfo(part: string): string {
  const tpl = partTemplate(part)
  return t('tex.info', {
    part,
    cw: tpl.cw,
    ch: tpl.ch,
    lw: tpl.lw,
    lh: tpl.lh,
    scale: TEMPLATE_SCALE,
    px: Math.round(tpl.px),
    py: tpl.py,
  })
}

/** 在预览画布上绘制当前部件的图集帧 + 锚点标记 */
export function drawTexPreview(
  cv: HTMLCanvasElement,
  part: string,
  frame: AtlasFrame | null,
  source: HTMLCanvasElement | null,
): string {
  const g = cv.getContext('2d')!
  g.clearRect(0, 0, cv.width, cv.height)
  g.fillStyle = '#191d29'
  g.fillRect(0, 0, cv.width, cv.height)
  if (!frame || !source)
    return templateInfo(part)
  const scale = Math.min(160 / Math.max(frame.w, 1), 160 / Math.max(frame.h, 1), 4)
  const dw = frame.w * scale
  const dh = frame.h * scale
  const dx = (cv.width - dw) / 2
  const dy = (cv.height - dh) / 2
  g.imageSmoothingEnabled = false
  g.drawImage(source, frame.x, frame.y, frame.w, frame.h, dx, dy, dw, dh)
  // 锚点十字
  g.strokeStyle = '#ff5d7e'
  g.lineWidth = 1.5
  const px = dx + dw * 0.5
  const py = dy
  g.beginPath()
  g.moveTo(px - 6, py); g.lineTo(px + 6, py)
  g.moveTo(px, py - 6); g.lineTo(px, py + 6)
  g.stroke()
  // 方向提示
  g.fillStyle = '#7d88a3'
  g.font = '11px monospace'
  g.fillText(t('tex.anchorHint'), 8, cv.height - 8)
  return templateInfo(part)
}

/** 下载当前部件的纹理模板 PNG（虚线外框 + 锚点十字 + 尺寸标注） */
export function downloadTemplatePng(part: string): void {
  const tpl = partTemplate(part)
  const cv = document.createElement('canvas')
  cv.width = tpl.cw
  cv.height = tpl.ch
  const g = cv.getContext('2d')!
  g.strokeStyle = 'rgba(120,130,160,0.35)'
  g.setLineDash([4, 4])
  g.strokeRect(0.5, 0.5, tpl.cw - 1, tpl.ch - 1)
  g.setLineDash([])
  g.strokeStyle = '#ff5d7e'
  g.beginPath()
  g.moveTo(tpl.px - 8, tpl.py); g.lineTo(tpl.px + 8, tpl.py)
  g.moveTo(tpl.px, tpl.py - 8); g.lineTo(tpl.px, tpl.py + 8)
  g.stroke()
  g.fillStyle = '#8a93a8'
  g.font = '12px monospace'
  g.fillText(`${part} ${tpl.lw}x${tpl.lh} ×${TEMPLATE_SCALE}`, 8, 16)
  const a = document.createElement('a')
  a.download = `template_${part}.png`
  a.href = cv.toDataURL('image/png')
  a.click()
}
