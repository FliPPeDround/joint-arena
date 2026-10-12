import type { Messages } from './zh-CN'
import { enUS } from './en-US'
import { zhCN } from './zh-CN'

export type { Messages }

/** 支持的语言；新增语言时这里加一项，消息目录由类型约束强制补齐 */
export const messages = {
  'zh-CN': zhCN,
  'en-US': enUS,
} satisfies Record<string, Messages>

export type AppLocale = keyof typeof messages

export const AVAILABLE_LOCALES = Object.keys(messages) as AppLocale[]

/** 校验 localStorage / Worker 消息里带来的任意字符串 */
export function isAppLocale(value: string): value is AppLocale {
  return AVAILABLE_LOCALES.includes(value as AppLocale)
}

/** 浏览器语言匹配不上时的落点 */
export const FALLBACK_LOCALE: AppLocale = 'en-US'

type Join<A extends string, B extends string> = A extends '' ? B : `${A}.${B}`

/** 目录压平成点分键联合类型：t('lobby.newBattle') 的键在编译期校验 */
type LeafKeys<T, P extends string = ''> = T extends string
  ? P
  : { [K in keyof T & string]: LeafKeys<T[K], Join<P, K>> }[keyof T & string]

export type MsgKey = LeafKeys<Messages>
