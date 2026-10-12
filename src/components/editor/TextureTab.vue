<script setup lang="ts">
import ActionButton from '@antfu/design/components/Action/ActionButton.vue'
import { nextTick, onMounted, reactive, ref, watch } from 'vue'
import { downloadTemplatePng, drawTexPreview } from '../../editor/texturePreview'
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

function onColorInput(part: string, ev: Event): void {
  const color = (ev.target as HTMLInputElement).value
  colors[part] = color
  gameApi.value?.previewPartColor(part, color)
}
</script>

<template>
  <div class="docs flex-1 of-y-auto">
    <h3>纹理自定义</h3>
    <p>每个部件 = 一个插槽。三种自定义方式：<b>染色</b>（下方色板，实时生效）、<b>图片</b>、<b>Canvas 绘制</b>（均通过 SDK 代码调用，见 SDK 文档）。</p>
    <p>自定义贴图建议按模板尺寸绘制（= 部件尺寸 × 4），锚点在<b>顶边中点</b>，渲染时贴图竖直向下、随部件旋转。</p>

    <canvas ref="previewCanvas" width="240" height="240" class="my-2 border border-base rounded-lg" />
    <div class="text-mini color-muted mb-2">
      {{ previewInfo || '正在加载图集…' }}
    </div>
    <ActionButton size="sm" class="mb-2.5" @click="downloadTemplatePng(texPart)">
      ⬇ 下载当前部件模板 PNG
    </ActionButton>

    <table class="text-mini w-full border-collapse">
      <thead>
        <tr>
          <th class="font-bold px-2 py-0.5 text-left border border-base bg-secondary">
            部件
          </th>
          <th class="font-bold px-2 py-0.5 text-left border border-base bg-secondary">
            尺寸(宽×高)
          </th>
          <th class="font-bold px-2 py-0.5 text-left border border-base bg-secondary">
            染色
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
              重置
            </ActionButton>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
