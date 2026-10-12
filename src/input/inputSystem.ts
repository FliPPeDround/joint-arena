import type { InputEventMsg } from '../sdk/protocol'

export type GameInputEvent = InputEventMsg

/** 键盘 + 鼠标采集，转发给沙箱，支持状态查询 */
export class InputSystem {
  keys = new Set<string>()
  mouse = { x: 0, y: 0, buttons: 0 }
  private events: GameInputEvent[] = []
  private canvas: HTMLCanvasElement
  private toWorld: (sx: number, sy: number) => [number, number]
  private attached = true

  private onWindowBlur = (): void => {
    this.keys.clear()
    this.mouse.buttons = 0
  }

  constructor(canvas: HTMLCanvasElement, toWorld: (sx: number, sy: number) => [number, number]) {
    this.canvas = canvas
    this.toWorld = toWorld
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    canvas.addEventListener('mousemove', this.onMouseMove)
    canvas.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mouseup', this.onMouseUp)
    canvas.addEventListener('contextmenu', e => e.preventDefault())
    window.addEventListener('blur', this.onWindowBlur)
  }

  private isEditing(e: Event): boolean {
    const t = e.target as HTMLElement | null
    return !!t && typeof t.closest === 'function' && t.closest('#editor-panel') !== null
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.isEditing(e))
      return
    const k = e.key.toLowerCase()
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k))
      e.preventDefault()
    if (!this.keys.has(k))
      this.events.push({ kind: 'key', key: k, phase: 'down' })
    this.keys.add(k)
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    if (this.isEditing(e))
      return
    const k = e.key.toLowerCase()
    this.keys.delete(k)
    this.events.push({ kind: 'key', key: k, phase: 'up' })
  }

  private onMouseMove = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect()
    const [wx, wy] = this.toWorld(e.clientX - rect.left, e.clientY - rect.top)
    this.mouse.x = wx; this.mouse.y = wy
    this.events.push({ kind: 'mousemove', x: wx, y: wy })
  }

  private onMouseDown = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect()
    const [wx, wy] = this.toWorld(e.clientX - rect.left, e.clientY - rect.top)
    this.mouse.x = wx; this.mouse.y = wy
    this.mouse.buttons |= 1 << e.button
    this.events.push({ kind: 'mouse', button: e.button, phase: 'down', x: wx, y: wy })
  }

  private onMouseUp = (e: MouseEvent): void => {
    this.mouse.buttons &= ~(1 << e.button)
    this.events.push({ kind: 'mouse', button: e.button, phase: 'up', x: this.mouse.x, y: this.mouse.y })
  }

  isKeyDown(key: string): boolean {
    return this.keys.has(key.toLowerCase())
  }

  drainEvents(): GameInputEvent[] {
    const out = this.events
    this.events = []
    return out
  }

  dispose(): void {
    if (!this.attached)
      return
    this.attached = false
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('mouseup', this.onMouseUp)
    window.removeEventListener('blur', this.onWindowBlur)
  }
}
