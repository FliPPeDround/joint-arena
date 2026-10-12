<script setup lang="ts">
import BattleMenu from '../components/BattleMenu.vue'
import HudOverlay from '../components/HudOverlay.vue'
import RoundBanner from '../components/RoundBanner.vue'
</script>

<template>
  <!-- 对战交互层：叠在常驻舞台（完整对抗局）之上，整幅 HUD 无代码编辑工作区（菜单在 ESC 呼出）。
       根层不拦截指针：对战键鼠输入属于画布（InputSystem），只有菜单弹层回收指针 -->
  <div class="color-base font-sans pointer-events-none inset-0 absolute of-hidden">
    <HudOverlay />
    <RoundBanner />
    <BattleMenu />
  </div>
</template>
