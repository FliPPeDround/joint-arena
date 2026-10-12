import { reactive, watch } from 'vue'
import { t } from '../i18n'

export interface Profile {
  name: string
  battles: number
  wins: number
  draws: number
}

const LS_KEY = 'joint-arena.profile'

function load(): Profile {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Profile
      if (typeof p.name === 'string')
        return { name: p.name, battles: p.battles || 0, wins: p.wins || 0, draws: p.draws || 0 }
    }
  }
  catch { /* 损坏则重置 */ }
  // 默认名是首次启动时的展示数据，按当时语言落一份，之后归用户自己改
  return { name: t('profile.defaultName'), battles: 0, wins: 0, draws: 0 }
}

/** 本地用户档案：大厅展示 + 训练模式战果（无后端，localStorage 持久化） */
export const profile = reactive<Profile>(load())

watch(profile, (v) => {
  localStorage.setItem(LS_KEY, JSON.stringify(v))
})

export function renameProfile(name: string): void {
  const trimmed = name.trim()
  if (trimmed)
    profile.name = trimmed
}

/** 引擎在回合分出胜负时调用（P1 = 本地玩家） */
export function recordMatchResult(winner: 'P1' | 'P2' | 'draw'): void {
  profile.battles++
  if (winner === 'P1')
    profile.wins++
  else if (winner === 'draw')
    profile.draws++
}
