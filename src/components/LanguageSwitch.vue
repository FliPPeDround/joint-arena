<script setup lang="ts">
import type { AppLocale } from '../i18n/messages'
import ActionToggleGroup from '@antfu/design/components/Action/ActionToggleGroup.vue'
import { locale, setLocale, t } from '../i18n'
import { AVAILABLE_LOCALES, isAppLocale } from '../i18n/messages'

/** 语言名用自称（中文 / English），两种界面上都一样，不进消息目录 */
const LANGUAGE_NAMES: Record<AppLocale, string> = {
  'zh-CN': '中文',
  'en-US': 'English',
}

const options = AVAILABLE_LOCALES.map(value => ({ value, label: LANGUAGE_NAMES[value] }))

function pick(value: string | string[] | undefined): void {
  if (typeof value === 'string' && isAppLocale(value))
    setLocale(value)
}
</script>

<template>
  <ActionToggleGroup
    :model-value="locale"
    :options="options"
    :aria-label="t('common.language')"
    @update:model-value="pick"
  />
</template>
