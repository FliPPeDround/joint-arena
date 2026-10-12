<script setup lang="ts">
import ActionButton from '@antfu/design/components/Action/ActionButton.vue'
import { nextTick, onMounted, reactive, ref, watch } from 'vue'
import { downloadTemplatePng, drawTexPreview } from '../../editor/texturePreview'
import { locale, t } from '../../i18n'
import { ALL_PARTS, PARTS } from '../../skeleton/partDefs'
import { gameApi } from '../../stores/game'

const texPart = ref('head')
const previewInfo = ref('')
const previewCanvas = ref<HTMLCanvasElement>()
const colors = reactive<Record<string, string>>(
  Object.fromEntries(ALL_PARTS.map(p => [p, '#ffffff'])),
)

function redraw(): void {
  if (!previewCanvas.value || !gameApi.value)
    return
  previewInfo.value = drawTexPreview(
    previewCanvas.value,
    texPart.value,
    gameApi.value.getAtlasFrame(texPart.value),
    gameApi.value.getDefaultTextureSource(),
  )
}

onMounted(redraw)
watch(texPart, () => nextTick(redraw))
watch(gameApi, () => nextTick(redraw))
// 画布上的锚点提示与规格行是文字，换语言后必须重绘
watch(locale, () => nextTick(redraw))

function onColorInput(part: string, ev: Event): void {
  const color = (ev.target as HTMLInputElement).value
  colors[part] = color
  gameApi.value?.previewPartColor(part, color)
}
</script>

<template>
  <div class="docs flex-1 of-y-auto">
    <h3>{{ t('tex.title') }}</h3>
    <!-- eslint-disable-next-line vue/no-v-html — 文案是应用内静态字符串（含 <b> 强调），非用户输入 -->
    <p v-html="t('tex.intro')" />
    <!-- eslint-disable-next-line vue/no-v-html -->
    <p v-html="t('tex.spec')" />

    <canvas ref="previewCanvas" width="240" height="240" class="my-2 border border-base rounded-lg" />
    <div class="text-mini color-muted mb-2">
      {{ previewInfo || t('tex.loadingAtlas') }}
    </div>
    <ActionButton size="sm" class="mb-2.5" @click="downloadTemplatePng(texPart)">
      {{ t('tex.downloadPng') }}
    </ActionButton>

    <table class="text-mini w-full border-collapse">
      <thead>
        <tr>
          <th class="font-bold px-2 py-0.5 text-left border border-base bg-secondary">
            {{ t('tex.colPart') }}
          </th>
          <th class="font-bold px-2 py-0.5 text-left border border-base bg-secondary">
            {{ t('tex.colSize') }}
          </th>
          <th class="font-bold px-2 py-0.5 text-left border border-base bg-secondary">
            {{ t('tex.colTint') }}
          </th>
          <th class="font-bold px-2 py-0.5 text-left border border-base bg-secondary" />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="p in ALL_PARTS"
          :key="p"
          class="cursor-pointer hover:bg-hover"
          :class="p === texPart ? 'bg-active' : ''"
          @click="texPart = p"
        >
          <td class="font-mono px-2 py-0.5 border border-base">
            {{ p }}
          </td>
          <td class="font-mono px-2 py-0.5 border border-base">
            {{ PARTS[p].W }}×{{ PARTS[p].L }}
          </td>
          <td class="px-2 py-0.5 border border-base">
            <input
              type="color"
              :value="colors[p]"
              class="bg-transparent h-5.5 w-10 cursor-pointer"
              @input="onColorInput(p, $event)"
              @click.stop
            >
          </td>
          <td class="px-2 py-0.5 border border-base">
            <ActionButton size="sm" @click.stop="gameApi?.resetPart(p)">
              {{ t('tex.reset') }}
            </ActionButton>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
