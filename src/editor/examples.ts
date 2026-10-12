import type { AppLocale } from '../i18n/messages'
import { locale, t } from '../i18n'
import { EXAMPLE_CODES as EXAMPLE_CODES_EN, STARTER_CODE as STARTER_CODE_EN } from './examples.en-US'
import { EXAMPLE_CODES as EXAMPLE_CODES_ZH, STARTER_CODE as STARTER_CODE_ZH } from './examples.zh-CN'

/**
 * 示例玩家代码 —— 在 Worker 沙箱中运行，通过 sdk 与游戏交互。
 * 代码正文按语言分文件（zh-CN / en-US 各一份，逻辑完全相同，只翻注释与 sdk.log 文案）；
 * 名称是 UI 标签，走消息目录 examples.*。
 */
export const EXAMPLE_IDS = [
  '01_standing',
  '02_walk',
  '03_punch',
  '04_kick',
  '05_guard',
  '06_texture',
  '07_full_fighter',
] as const

export type ExampleId = typeof EXAMPLE_IDS[number]

const EXAMPLE_CODES: Record<AppLocale, Record<ExampleId, string>> = {
  'zh-CN': EXAMPLE_CODES_ZH,
  'en-US': EXAMPLE_CODES_EN,
}

const STARTER_CODES: Record<AppLocale, string> = {
  'zh-CN': STARTER_CODE_ZH,
  'en-US': STARTER_CODE_EN,
}

/** 训练模式的对手（跑在 P2 沙箱里）：完整格斗 AI 示例 */
export const BOT_EXAMPLE_ID: ExampleId = '07_full_fighter'

/** 示例名：`numbered=false` 剥掉「01 」前缀，给预设卡片当名字 */
export function exampleName(id: ExampleId, numbered = true): string {
  const name = t(`examples.${id}`)
  return numbered ? name : name.replace(/^\d+\s*/, '')
}

export function exampleCode(id: ExampleId): string {
  return EXAMPLE_CODES[locale.value][id]
}

/** 新建预设的初始代码：一段能站稳的最小骨架，便于直接进预览调参 */
export function starterCode(): string {
  return STARTER_CODES[locale.value]
}

export function botCode(): string {
  return exampleCode(BOT_EXAMPLE_ID)
}
