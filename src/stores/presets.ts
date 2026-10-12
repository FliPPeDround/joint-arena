import { reactive, watch } from 'vue'
import { EXAMPLES, STARTER_CODE } from '../editor/examples'

/** 预设：一套保存下来的角色代码（大厅选卡开局，编辑页维护） */
export interface Preset {
  id: string
  name: string
  code: string
  /** 内置示例预设：不可删除，编辑需先复制 */
  builtin: boolean
  updatedAt: number
}

const LS_KEY = 'joint-arena.presets'
const LS_SELECTED = 'joint-arena.preset.selected'

function seedFromExamples(): Preset[] {
  const now = Date.now()
  return EXAMPLES.map((ex, i) => ({
    id: `builtin.${ex.id}`,
    name: ex.name.replace(/^\d+\s*/, ''),
    code: ex.code,
    builtin: true,
    updatedAt: now - (EXAMPLES.length - i) * 60_000,
  }))
}

function load(): Preset[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as Preset[]
      if (Array.isArray(arr) && arr.length && arr.every(p => p && typeof p.id === 'string'))
        return syncBuiltins(arr)
    }
  }
  catch { /* 损坏则重新播种 */ }
  return seedFromExamples()
}

/**
 * 内置预设与当前示例代码保持同步（旧版本存档里的示例代码刷新为最新，
 * 新增的内置示例补进列表，已下架的移除），用户预设原样保留、顺序不动。
 * 内置预设不可就地编辑（保存会另起副本），所以覆盖 code / name 是安全的。
 */
function syncBuiltins(list: Preset[]): Preset[] {
  const seeds = seedFromExamples()
  const seedById = new Map(seeds.map(s => [s.id, s]))
  const out: Preset[] = []
  const seen = new Set<string>()
  for (const p of list) {
    if (p.builtin) {
      const seed = seedById.get(p.id)
      if (!seed)
        continue
      seen.add(p.id)
      out.push({ ...p, name: seed.name, code: seed.code })
    }
    else {
      out.push(p)
    }
  }
  for (const s of seeds) {
    if (!seen.has(s.id))
      out.push(s)
  }
  return out
}

export const presets = reactive({
  list: load(),
  selectedId: localStorage.getItem(LS_SELECTED) ?? '',
})

if (!presets.list.some(p => p.id === presets.selectedId))
  presets.selectedId = presets.list[0]?.id ?? ''

watch(presets, (v) => {
  localStorage.setItem(LS_KEY, JSON.stringify(v.list))
  localStorage.setItem(LS_SELECTED, v.selectedId)
})

export function getPreset(id: string): Preset | undefined {
  return presets.list.find(p => p.id === id)
}

export function getSelected(): Preset | undefined {
  return getPreset(presets.selectedId)
}

export function selectPreset(id: string): void {
  presets.selectedId = id
}

function nextId(): string {
  return `u.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 8)}`
}

export function createPreset(name: string, code: string): Preset {
  const p: Preset = { id: nextId(), name: name.trim() || '未命名预设', code, builtin: false, updatedAt: Date.now() }
  presets.list.push(p)
  presets.selectedId = p.id
  return p
}

/** 内置预设复制出可编辑副本 */
export function duplicatePreset(id: string): Preset | undefined {
  const src = getPreset(id)
  if (!src)
    return undefined
  return createPreset(`${src.name} 副本`, src.code)
}

export function updatePreset(id: string, patch: Partial<Pick<Preset, 'name' | 'code'>>): void {
  const p = getPreset(id)
  if (!p)
    return
  if (patch.name !== undefined) {
    const name = patch.name.trim()
    if (name)
      p.name = name
  }
  if (patch.code !== undefined)
    p.code = patch.code
  p.updatedAt = Date.now()
}

export function removePreset(id: string): void {
  const i = presets.list.findIndex(p => p.id === id)
  if (i < 0 || presets.list[i].builtin)
    return
  presets.list.splice(i, 1)
  if (presets.selectedId === id)
    presets.selectedId = presets.list[Math.max(0, i - 1)]?.id ?? ''
}

/** 新建预设的初始代码：一段能站稳的最小骨架，便于直接进预览调参 */
export function newPresetCode(): string {
  return STARTER_CODE
}

/** 把代码（和可选的新名字）保存到预设；目标是内置预设时自动复制一份写入副本，返回实际保存到的预设 */
export function saveCodeToPreset(id: string, code: string, name?: string): Preset | undefined {
  const p = getPreset(id)
  if (!p)
    return undefined
  if (p.builtin)
    return createPreset(name?.trim() || `${p.name} 副本`, code)
  updatePreset(id, { code, name })
  return p
}
