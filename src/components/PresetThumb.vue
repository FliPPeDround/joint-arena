<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { renderPresetThumb } from '../editor/presetThumb'

const props = defineProps<{ code: string }>()

const cv = ref<HTMLCanvasElement>()

function render(): void {
  if (cv.value)
    renderPresetThumb(cv.value, props.code)
}

onMounted(render)
watch(() => props.code, render)
</script>

<template>
  <!-- 内部 2× 分辨率，CSS 铺满父容器（父容器定 aspect-[4/5]） -->
  <canvas ref="cv" width="272" height="340" class="h-full w-full block" />
</template>
