// Vite 构建下 worker 需经由本地相对入口打包（?worker 只能写在本地文件上）；
// monaco 0.53+ 的 exports map 要求子路径省略 esm/vs/ 前缀。
import 'monaco-editor/editor/editor.worker.js'
