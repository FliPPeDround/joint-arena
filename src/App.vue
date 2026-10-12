<script setup lang="ts">
import GameStage from './components/GameStage.vue'
</script>

<template>
  <!-- 游戏式分层：世界（舞台画布 + 引擎）常驻底层，路由场景只是叠加在世界上面的交互层。
       场景切换 = 交互层 crossfade + 引擎玩法热切换（GameStage 场景导演），世界本身不卸载 -->
  <GameStage />
  <RouterView v-slot="{ Component, route }">
    <Transition name="scene">
      <component :is="Component" :key="route.name" />
    </Transition>
  </RouterView>
</template>
