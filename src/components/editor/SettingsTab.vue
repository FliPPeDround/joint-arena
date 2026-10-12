<script setup lang="ts">
import type { DebugToggles } from '../../stores/game'
import DisplayKbd from '@antfu/design/components/Display/DisplayKbd.vue'
import FormSwitch from '@antfu/design/components/Form/FormSwitch.vue'
import { computed } from 'vue'
import { t } from '../../i18n'
import { gameStore } from '../../stores/game'
import LanguageSwitch from '../LanguageSwitch.vue'

const debugKeys: (keyof DebugToggles)[] = ['colliders', 'joints', 'bones', 'rays']

const boundEntries = computed(() => Object.entries(gameStore.boundKeys))
</script>

<template>
  <div class="docs flex-1 of-y-auto">
    <h3>{{ t('settings.debugView') }}</h3>
    <div class="my-2 flex flex-col gap-2">
      <FormSwitch
        v-for="k in debugKeys"
        :key="k"
        v-model="gameStore.debug[k]"
        :label="t(`debug.${k}`)"
      />
    </div>

    <h3>{{ t('common.language') }}</h3>
    <div class="my-2">
      <LanguageSwitch />
    </div>

    <h3>{{ t('settings.keyBindings') }}</h3>
    <div v-if="boundEntries.some(([, keys]) => keys.length)" class="my-2 flex flex-col gap-1">
      <template v-for="[f, keys] in boundEntries" :key="f">
        <div v-if="keys.length" class="flex gap-1.5 items-center">
          <b>{{ f }}</b>
          <DisplayKbd v-for="k in keys" :key="k" :keys="k" />
        </div>
      </template>
    </div>
    <div v-else class="color-muted">
      {{ t('settings.keysEmpty') }}
    </div>

    <h3>{{ t('settings.howTo') }}</h3>
    <p>{{ t('settings.howToP1') }}</p>
    <p>{{ t('settings.howToP2') }}</p>
  </div>
</template>
