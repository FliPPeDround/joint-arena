<script setup lang="ts">
import type { DebugToggles } from '../../stores/game'
import DisplayKbd from '@antfu/design/components/Display/DisplayKbd.vue'
import FormSwitch from '@antfu/design/components/Form/FormSwitch.vue'
import { computed } from 'vue'
import { gameStore } from '../../stores/game'

const debugItems: { key: keyof DebugToggles, label: string }[] = [
  { key: 'colliders', label: '碰撞体' },
  { key: 'joints', label: '关节与角度' },
  { key: 'bones', label: '骨骼' },
  { key: 'rays', label: '射线' },
]

const boundEntries = computed(() => Object.entries(gameStore.boundKeys))
</script>

<template>
  <div class="docs flex-1 of-y-auto">
    <h3>调试视图</h3>
    <div class="my-2 flex flex-col gap-2">
      <FormSwitch
        v-for="d in debugItems"
        :key="d.key"
        v-model="gameStore.debug[d.key]"
        :label="d.label"
      />
    </div>

    <h3>按键绑定</h3>
    <div v-if="boundEntries.some(([, keys]) => keys.length)" class="my-2 flex flex-col gap-1">
      <template v-for="[f, keys] in boundEntries" :key="f">
        <div v-if="keys.length" class="flex gap-1.5 items-center">
          <b>{{ f }}</b>
          <DisplayKbd v-for="k in keys" :key="k" :keys="k" />
        </div>
      </template>
    </div>
    <div v-else class="color-muted">
      （运行玩家代码后显示）
    </div>

    <h3>操作说明</h3>
    <p>点「运行 / 重置回合」后按键立即生效；焦点在代码编辑器内时不转发按键（避免打字误触）。默认示例：A/D 移动，J 出拳，K 踢腿，S 格挡。</p>
    <p>代码运行在 Web Worker 沙箱中：死循环不会卡死游戏（600ms 无响应会自动终止该角色逻辑）。</p>
  </div>
</template>
