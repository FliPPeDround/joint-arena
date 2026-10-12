import type { MsgKey } from '../i18n/messages'

/**
 * 沙箱 / 引擎的结构化错误：只带错误码与参数，不带文案。
 * 文本由宿主在渲染时按当前语言从目录 sdkErr.* 取，因此 Worker 侧不需要 i18n，
 * 切语言后控制台里的历史错误行也能跟着变。
 *
 * 错误码由目录推导：新增 `new SdkError('foo')` 而 sdkErr.foo 不存在时，typecheck 直接失败。
 */
export type SdkErrorKey = Extract<MsgKey, `sdkErr.${string}`>
export type SdkErrorCode = SdkErrorKey extends `sdkErr.${infer C}` ? C : never

/** 消息插值参数（必须可 structuredClone 过 Worker 边界） */
export type SdkErrorArgs = Record<string, string | number | boolean | undefined>

export class SdkError extends Error {
  readonly key: SdkErrorKey
  readonly args?: SdkErrorArgs

  constructor(code: SdkErrorCode, args?: SdkErrorArgs) {
    // message 只作开发用标识（原始堆栈里可 grep），玩家看到的是 key 对应的本地化文案
    super(`sdkErr.${code}`)
    this.name = 'SdkError'
    this.key = `sdkErr.${code}` as SdkErrorKey
    this.args = args
  }
}
