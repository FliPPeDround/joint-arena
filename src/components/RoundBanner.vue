<script setup lang="ts">
import { computed } from 'vue'
import { formatMsg } from '../i18n'
import { gameStore } from '../stores/game'

/** 横幅文字由引擎写入消息键，这里按当前语言渲染（切语言时已挂出的横幅也跟着变） */
const mainText = computed(() => {
  const main = gameStore.hud.banner.main
  return main ? formatMsg(main) : ''
})
const subText = computed(() => {
  const sub = gameStore.hud.banner.sub
  return sub ? formatMsg(sub) : ''
})

/** 胜方辉光用玩家身份色（对局未分胜负时落回品牌绿） */
const glowStyle = computed(() => {
  const color = gameStore.matchWinner === 'P1'
    ? 'var(--ja-p1)'
    : gameStore.matchWinner === 'P2'
      ? 'var(--ja-p2)'
      : 'var(--ja-accent)'
  return { textShadow: `0 0 24px color-mix(in srgb, ${color} 90%, transparent)` }
})
</script>

<template>
  <Transition name="banner">
    <div
      v-if="gameStore.hud.banner.visible"
      class="text-center pointer-events-none inset-x-0 top-[38%] absolute z-banner"
    >
      <div class="i18n-display text-7xl text-white tracking-[8px] font-black" :style="glowStyle">
        {{ mainText }}
      </div>
      <div v-if="subText" class="text-base color-muted mt-2.5">
        {{ subText }}
      </div>
    </div>
  </Transition>
</template>
