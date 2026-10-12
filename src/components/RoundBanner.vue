<script setup lang="ts">
import { computed } from 'vue'
import { gameStore } from '../stores/game'

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
      <div class="text-7xl text-white tracking-[8px] font-black" :style="glowStyle">
        {{ gameStore.hud.banner.main }}
      </div>
      <div v-if="gameStore.hud.banner.sub" class="text-base color-muted mt-2.5">
        {{ gameStore.hud.banner.sub }}
      </div>
    </div>
  </Transition>
</template>
