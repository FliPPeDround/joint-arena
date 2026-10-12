import type { AppLocale } from '../i18n/messages'
import { computed } from 'vue'
import { locale } from '../i18n'
import { SDK_DOCS_HTML as SDK_DOCS_EN } from './sdkDocs.en-US'
import { SDK_DOCS_HTML as SDK_DOCS_ZH } from './sdkDocs.zh-CN'

const DOCS: Record<AppLocale, string> = {
  'zh-CN': SDK_DOCS_ZH,
  'en-US': SDK_DOCS_EN,
}

/** 应用内「SDK 文档」标签页的 HTML，随语言切换（正文与 docs/SDK.md 保持一致） */
export const sdkDocsHtml = computed(() => DOCS[locale.value])
