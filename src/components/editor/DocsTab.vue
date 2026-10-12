<script setup lang="ts">
import { SDK_DOCS_HTML } from '../../editor/sdkDocs'
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html — 文档内容为应用内静态字符串，非用户输入 -->
  <div class="docs flex-1 of-y-auto" v-html="SDK_DOCS_HTML" />
</template>
