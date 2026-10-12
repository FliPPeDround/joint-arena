<script setup lang="ts">
import type { Preset } from '../stores/presets'
import ActionIconButton from '@antfu/design/components/Action/ActionIconButton.vue'
import DisplayBadge from '@antfu/design/components/Display/DisplayBadge.vue'
import FormTextInput from '@antfu/design/components/Form/FormTextInput.vue'
import OverlayConfirm from '@antfu/design/components/Overlay/OverlayConfirm.vue'
import OverlayModal from '@antfu/design/components/Overlay/OverlayModal.vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import PresetThumb from '../components/PresetThumb.vue'
import { createPreset, duplicatePreset, newPresetCode, presets, removePreset, selectPreset } from '../stores/presets'
import { profile, renameProfile } from '../stores/profile'
import { openEditor, startTraining } from '../stores/ui'

// ---- 帧率读数（真实测量，主菜单左上角） ----
const fps = ref(0)
let rafId = 0
let frames = 0
let markAt = performance.now()

function countFrame(now: number): void {
  frames++
  if (now - markAt >= 500) {
    fps.value = Math.round((frames * 1000) / (now - markAt))
    frames = 0
    markAt = now
  }
  rafId = requestAnimationFrame(countFrame)
}

onMounted(() => {
  rafId = requestAnimationFrame(countFrame)
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
})

// ---- 主菜单 ----
const modeModalOpen = ref(false)

// ---- 玩家档案（右上菱章） ----
const renaming = ref(false)
const nameDraft = ref('')

function startRename(): void {
  nameDraft.value = profile.name
  renaming.value = true
}

function commitRename(): void {
  if (renaming.value) {
    renameProfile(nameDraft.value)
    renaming.value = false
  }
}

const winRate = computed(() => profile.battles ? Math.round((profile.wins / profile.battles) * 100) : 0)

// ---- 预设库 ----
const selectedPreset = computed(() => presets.list.find(p => p.id === presets.selectedId))

/** 内置预设只读：编辑时自动复制成可编辑副本 */
function editPreset(p: Preset): void {
  if (p.builtin) {
    const copy = duplicatePreset(p.id)
    if (copy)
      openEditor(copy.id)
  }
  else {
    openEditor(p.id)
  }
}

function createAndEdit(): void {
  const p = createPreset('未命名预设', newPresetCode())
  openEditor(p.id)
}

const pendingDeleteId = ref('')
const deleteConfirmOpen = ref(false)

function askDelete(id: string): void {
  pendingDeleteId.value = id
  deleteConfirmOpen.value = true
}

/**
 * 确认删除。注意不能依赖 pendingDeleteId 在弹窗关闭后仍存活：
 * reka-ui 的 AlertDialogAction 点击时先同步关闭弹窗（update:open 先于 confirm 事件），
 * 所以开关必须与待删 id 解耦，confirm 时 id 还在才能删掉。
 */
function confirmDelete(): void {
  const id = pendingDeleteId.value
  deleteConfirmOpen.value = false
  if (id)
    removePreset(id)
  pendingDeleteId.value = ''
}

// ESC / 取消等只走 update:open 的关闭路径：清掉挂起的删除目标
watch(deleteConfirmOpen, (open) => {
  if (!open)
    pendingDeleteId.value = ''
})

const pendingDeletePreset = computed(() => presets.list.find(p => p.id === pendingDeleteId.value))
</script>

<template>
  <!-- 大厅交互层：叠在常驻舞台（演武场 demo 局）之上。画布与引擎在 GameStage，这里只有菜单与表单 -->
  <div class="color-base font-sans inset-0 absolute of-hidden">
    <!-- 舞台遮罩：暗角 + 可读性渐变（游戏领域样式，定义在 main.css） -->
    <div class="lobby-stage-veil pointer-events-none inset-0 absolute" />

    <!-- 左上：字标 + 真实数据读数 -->
    <div class="select-none left-6 top-5 absolute z-hud lg:left-10 lg:top-6">
      <div class="text-lg tracking-[0.35em] font-display op-90">
        JOINT ARENA
      </div>
      <div class="text-mini color-faint font-mono mt-1">
        原型 0.1 · 帧率 {{ fps || '--' }}
      </div>
    </div>

    <!-- 右上：玩家档案菱章（改名入口） -->
    <div class="flex gap-4 items-start right-6 top-5 absolute z-hud lg:right-10 lg:top-6">
      <div class="text-right">
        <button
          v-if="!renaming"
          class="text-mini color-faint ml-auto outline-none block cursor-pointer transition focus-visible:color-base hover:color-muted"
          @click="startRename()"
        >
          点击改名
        </button>
        <template v-if="!renaming">
          <div class="text-2xl leading-tight font-display mt-0.5">
            {{ profile.name }}
          </div>
          <div class="text-mini color-muted font-mono mt-1">
            {{ profile.battles }} 场 · 胜率 {{ winRate }}%
          </div>
        </template>
        <FormTextInput
          v-else v-model="nameDraft" size="sm" class="mt-1 w-36!" autofocus
          @keydown.enter="commitRename()" @blur="commitRename()"
        />
      </div>
      <div class="lobby-diamond mt-2" :title="`胜场 ${profile.wins}`">
        <span class="text-base font-bold font-mono tabular-nums">{{ profile.wins }}</span>
      </div>
    </div>

    <!-- 左侧主菜单：宋体竖排，层级递进缩进 -->
    <nav class="flex flex-col gap-7 pointer-events-none left-6 top-[17vh] absolute z-hud lg:left-14" aria-label="主菜单">
      <div>
        <button
          class="group text-left outline-none flex gap-4 cursor-pointer pointer-events-auto items-center focus-visible:ring-2 focus-visible:ring-primary-500/40"
          @click="modeModalOpen = true"
        >
          <span class="bg-primary-400 shrink-0 h-2 w-2 rotate-45 scale-0 transition-transform duration-200 group-focus-visible:scale-100 group-hover:scale-100" aria-hidden="true" />
          <span class="text-5xl tracking-[0.28em] font-bold font-display op-95 transition-opacity group-hover:op-100">新的对决</span>
        </button>
        <p class="text-mini color-faint font-mono mt-1 pl-8 select-none">
          训练模式 · 与内建格斗 AI 对练
        </p>
      </div>

      <button
        class="group pl-5 text-left outline-none flex gap-4 cursor-pointer pointer-events-auto items-center disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:op-30!"
        :disabled="!selectedPreset"
        @click="selectedPreset && editPreset(selectedPreset)"
      >
        <span class="bg-primary-400 shrink-0 h-2 w-2 rotate-45 scale-0 transition-transform duration-200 group-focus-visible:scale-100 group-hover:scale-100" aria-hidden="true" />
        <span class="text-3xl tracking-[0.3em] font-bold font-display op-45 transition-opacity group-focus-visible:op-100 group-hover:op-100">编辑机体</span>
      </button>
    </nav>

    <!-- 底部：预设库选人席（常驻：选中机体 → 开始对决） -->
    <div class="inset-x-0 bottom-0 absolute z-hud">
      <div class="px-6 pb-4 lg:px-10">
        <div class="mb-2 flex gap-4 items-baseline justify-between">
          <h2 class="text-base tracking-[0.4em] font-display op-80">
            预设库
          </h2>
          <span class="text-mini color-faint select-none">点选机体 · 开战时使用它的代码</span>
        </div>
        <div class="no-scrollbar pb-1 flex gap-2.5 items-start overflow-x-auto">
          <div v-for="p in presets.list" :key="p.id" class="group shrink-0 w-24">
            <button class="text-left outline-none w-full block cursor-pointer" @click="selectPreset(p.id)">
              <div
                class="border rounded-md bg-sunken aspect-[4/5] transition relative of-hidden"
                :class="p.id === presets.selectedId
                  ? 'border-active ring-1 ring-primary-500/50'
                  : 'border-base op-75 hover:op-100 focus-within:op-100'"
              >
                <PresetThumb :code="p.code" />
                <DisplayBadge v-if="p.builtin" text="内置" :color="false" class="origin-top-left scale-90 left-1 top-1 absolute" />
              </div>
              <div
                class="text-compact mt-1.5 truncate transition-colors"
                :class="p.id === presets.selectedId ? 'color-active font-medium' : 'op-75'"
              >
                {{ p.name }}
              </div>
            </button>
            <div class="mt-0.5 op-0 flex gap-0.5 h-6 transition-opacity justify-end group-focus-within:op-100 group-hover:op-100">
              <ActionIconButton compact icon="i-ph:pencil-simple-line" label="编辑" @click="editPreset(p)" />
              <ActionIconButton compact icon="i-ph:copy" label="复制副本" @click="duplicatePreset(p.id)" />
              <ActionIconButton
                v-if="!p.builtin" compact icon="i-ph:trash" label="删除"
                @click="askDelete(p.id)"
              />
            </div>
          </div>

          <!-- 新建预设 -->
          <button
            class="color-faint outline-none border border-base rounded-md border-dashed bg-transparent flex shrink-0 flex-col gap-1.5 w-24 aspect-[4/5] cursor-pointer transition items-center justify-center hover:color-base hover:bg-hover focus-visible:ring-2 focus-visible:ring-primary-500/40 active:scale-98"
            @click="createAndEdit()"
          >
            <span class="i-ph:plus text-xl" aria-hidden="true" />
            <span class="text-compact">新建</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 模式选择 -->
    <OverlayModal v-model:open="modeModalOpen" title="新的对决" description="选择对战模式">
      <div class="gap-3 grid sm:grid-cols-2">
        <button
          class="p-4 text-left outline-none border border-base rounded-lg bg-raised cursor-pointer transition hover:bg-hover focus-visible:ring-2 focus-visible:ring-primary-500/40 active:scale-98"
          :disabled="!presets.selectedId"
          @click="startTraining(presets.selectedId)"
        >
          <span class="i-ph:robot text-3xl mb-2 block" aria-hidden="true" />
          <div class="font-bold">
            训练模式
          </div>
          <div class="text-mini color-muted mt-1">
            与内建格斗 AI 对练，使用选中的预设
          </div>
        </button>
        <div class="p-4 border border-base rounded-lg bg-raised op-50 relative">
          <span class="i-ph:users-three text-3xl mb-2 block" aria-hidden="true" />
          <div class="font-bold">
            联机模式
          </div>
          <div class="text-mini color-muted mt-1">
            与其他玩家实时对战
          </div>
          <DisplayBadge text="即将推出" color="amber" class="right-3 top-3 absolute" />
        </div>
      </div>
    </OverlayModal>

    <!-- 删除预设确认 -->
    <OverlayConfirm
      v-model:open="deleteConfirmOpen"
      title="删除这个预设？"
      :description="pendingDeletePreset ? `「${pendingDeletePreset.name}」的代码将被删除，此操作无法撤销。` : ''"
      variant="danger"
      confirm-label="删除"
      cancel-label="取消"
      @confirm="confirmDelete()"
    />
  </div>
</template>
