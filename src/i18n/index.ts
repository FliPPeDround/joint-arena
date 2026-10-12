import type { AppLocale, MsgKey } from './messages'
import { useLocalStorage } from '@vueuse/core'
import { watch } from 'vue'
import { createI18n } from 'vue-i18n'
import { SdkError } from '../sdk/sdkError'
import { AVAILABLE_LOCALES, FALLBACK_LOCALE, isAppLocale, messages } from './messages'

export type { AppLocale, MsgKey } from './messages'

/** 引擎 / 控制台 / 横幅里的一条可显示消息：目录键（渲染时翻译）或原样文本（玩家日志、异常堆栈） */
export interface LocalizedMsg {
  key: MsgKey
  params?: Record<string, unknown>
}
export interface RawMsg {
  raw: string
}
export type DisplayMsg = LocalizedMsg | RawMsg

/** 跟随浏览器：中文系（zh / zh-CN / zh-TW …）落中文，其余落英文 */
function detectLocale(): AppLocale {
  const tag = navigator.language.toLowerCase()
  return AVAILABLE_LOCALES.find(l => l.toLowerCase() === tag)
    ?? (tag.startsWith('zh') ? 'zh-CN' : FALLBACK_LOCALE)
}

/** 语言选择持久化，与 joint-arena.* 其余本地状态同一套 useLocalStorage 约定 */
export const locale = useLocalStorage<AppLocale>('joint-arena.locale', detectLocale())
// 存档值可能被旧版本或手工改坏，落到不存在的语言时按浏览器重新判定
if (!isAppLocale(locale.value))
  locale.value = detectLocale()

export const i18n = createI18n({
  legacy: false,
  globalInjection: false,
  locale: locale.value,
  fallbackLocale: FALLBACK_LOCALE,
  messages,
})

/**
 * legacy: false 下 global 是 Composer；这里只取实际用到的两个成员，
 * 让模板之外的上下文（engine / stores / canvas 文字）共用同一个翻译入口。
 */
const globalScope = i18n.global as unknown as {
  locale: { value: AppLocale }
  t: (key: MsgKey, params?: Record<string, unknown>) => string
}

/** 翻译：模板与非组件上下文都用它，键由目录联合类型校验 */
export function t(key: MsgKey, params?: Record<string, unknown>): string {
  return params === undefined ? globalScope.t(key) : globalScope.t(key, params)
}

export function msg(key: MsgKey, params?: Record<string, unknown>): LocalizedMsg {
  return { key, params }
}

export function rawMsg(raw: string): RawMsg {
  return { raw }
}

export function formatMsg(m: DisplayMsg): string {
  return 'raw' in m ? m.raw : t(m.key, m.params)
}

/** 异常 → 消息：自有 SdkError 走目录键，玩家代码抛出的异常按原文显示 */
export function errorToMsg(err: unknown): DisplayMsg {
  if (err instanceof SdkError)
    return msg(err.key, err.args)
  return rawMsg(err instanceof Error ? err.message : String(err))
}

export function errorToText(err: unknown): string {
  return formatMsg(errorToMsg(err))
}

export function setLocale(next: AppLocale): void {
  locale.value = next
}

// 语言是文档级状态：<html lang> 给排版/读屏/搜索引擎，标题跟随目录
watch(locale, (l) => {
  globalScope.locale.value = l
  document.documentElement.lang = l
  document.title = t('app.title')
}, { immediate: true })
