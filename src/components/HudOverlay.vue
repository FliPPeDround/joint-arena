<script setup lang="ts">
import type { FighterId } from '../config'
import type { MsgKey } from '../i18n'
import type { FighterState } from '../physics/fighterBody'
import { computed } from 'vue'
import { CFG } from '../config'
import { t } from '../i18n'
import { gameStore } from '../stores/game'

/** 异常姿态的状态位文案键；normal（正常）不占位，没提示可给 */
const STATE_KEY: Partial<Record<FighterState, MsgKey>> = {
  ko: 'hud.ko',
  down: 'hud.down',
  stun: 'hud.stun',
}

function hpPct(id: FighterId): number {
  return Math.max(0, (gameStore.hud.hp[id] / CFG.maxHp) * 100)
}

function hpText(id: FighterId): string {
  return `${Math.max(0, Math.ceil(gameStore.hud.hp[id]))}`
}

function stateLabel(id: FighterId): string {
  const key = STATE_KEY[gameStore.hud.state[id]]
  return key ? t(key) : ''
}

function fillStyle(id: FighterId): Record<string, string> {
  const varName = id === 'P1' ? '--ja-p1' : '--ja-p2'
  const low = hpPct(id) < 30
  return {
    width: `${hpPct(id)}%`,
    background: low
      ? 'linear-gradient(180deg, #ff9d5d, var(--ja-hp-low))'
      : `linear-gradient(180deg, color-mix(in srgb, var(${varName}) 82%, white), color-mix(in srgb, var(${varName}) 82%, black))`,
  }
}

const fighters = ['P1', 'P2'] as const
const nameColor = computed(() => ({ P1: 'var(--ja-p1)', P2: 'var(--ja-p2)' }))
</script>

<template>
  <div class="px-4 grid grid-cols-[1fr_auto_1fr] pointer-events-none items-start inset-x-0 top-2.5 absolute z-hud">
    <template v-for="(id, i) in fighters" :key="id">
      <div class="max-w-140 w-full" :class="i === 1 ? 'justify-self-end text-right' : ''">
        <div class="text-sm font-bold flex justify-between">
          <span :style="{ color: nameColor[id] }">{{ id }}</span>
          <span class="font-mono tabular-nums">{{ hpText(id) }}</span>
        </div>
        <div class="mt-0.75 border border-base rounded bg-black/60 h-4 overflow-hidden">
          <div class="h-full transition-width duration-150" :style="fillStyle(id)" />
        </div>
        <!-- 对战页没有控制台：角色逻辑出错（出错已暂停 / 死循环）时占用状态位提示 -->
        <div
          class="text-mini mt-0.5 h-4 truncate"
          :class="gameStore.status[id].error ? 'color-scale-critical' : 'text-amber-300'"
        >
          {{ gameStore.status[id].error ? t(gameStore.status[id].key) : stateLabel(id) }}
        </div>
      </div>
      <div
        v-if="i === 0"
        class="text-3xl font-extrabold font-mono px-4 py-1 text-center border border-base rounded-lg bg-black/60 justify-self-center tabular-nums"
      >
        {{ Math.max(0, Math.ceil(gameStore.hud.roundTime)) }}
      </div>
    </template>
  </div>
</template>
