<script setup lang="ts">
import { sdkDocsHtml } from '../../editor/sdkDocs'
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html — 文档内容为应用内静态字符串（按语言各一份），非用户输入 -->
  <div class="docs flex-1 of-y-auto" v-html="sdkDocsHtml" />
</template>
