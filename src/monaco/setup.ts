// @env browser
import type { FighterId } from '../config'
import * as monaco from 'monaco-editor'
import { watch } from 'vue'
import { SDK_DTS } from '../editor/sdkDts'
import { codes } from '../stores/game'
import EditorWorker from './editorWorker.ts?worker'
import TsWorker from './tsWorker.ts?worker'

// Monaco 的 language worker 通过 Vite 的 ?worker 导入打包
globalThis.MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === 'javascript' || label === 'typescript')
      return new TsWorker()
    return new EditorWorker()
  },
}

// 玩家代码里的 `sdk` 由沙箱运行时注入，语义校验必然误报；语法校验保留。
// sdk 的补全提示通过 extraLib 提供。
const jsDefaults = monaco.typescript.javascriptDefaults
jsDefaults.setDiagnosticsOptions({
  noSemanticValidation: true,
  noSyntaxValidation: false,
})
jsDefaults.addExtraLib(SDK_DTS, 'joint-arena-sdk.d.ts')

monaco.editor.defineTheme('ja-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: { 'editor.background': '#111111' },
})
monaco.editor.defineTheme('ja-light', {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: { 'editor.background': '#ffffff' },
})

export interface CodeModel {
  model: monaco.editor.ITextModel
  viewState: monaco.editor.ICodeEditorViewState | null
}

/** P1/P2 各一个模型：切换角色时换模型并恢复视图状态（滚动位置 / 光标） */
export const codeModels: Record<FighterId, CodeModel> = {
  P1: { model: monaco.editor.createModel(codes.P1, 'javascript'), viewState: null },
  P2: { model: monaco.editor.createModel(codes.P2, 'javascript'), viewState: null },
}

for (const id of ['P1', 'P2'] as const) {
  codeModels[id].model.onDidChangeContent(() => {
    codes[id] = codeModels[id].model.getValue()
  })
}

// codes 被外部写入（加载示例 / 大厅选预设开局 / 编辑页载入预设）时回写 Monaco 模型，
// 保证编辑器显示与实际运行的代码一致；不等时才 setValue，避免与上面的回调互相打转
watch(codes, (v) => {
  for (const id of ['P1', 'P2'] as const) {
    const model = codeModels[id].model
    if (model.getValue() !== v[id])
      model.setValue(v[id])
  }
})

export { monaco }
