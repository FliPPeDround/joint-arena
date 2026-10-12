import process from 'node:process'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'

// 部署到子路径时（如 GitHub Pages 的 /<repo>/）由构建命令注入绝对基址：
//   VITE_BASE=/joint-arena/ pnpm build
// 本地开发与 preview 保持相对基址，dist 可直接用任意静态服务器打开。
const base = process.env.VITE_BASE || './'

export default defineConfig({
  base,
  plugins: [vue(), UnoCSS()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        // pixi 与 monaco 体积巨大且更新频率不同，拆成独立 chunk 利于缓存
        manualChunks: {
          pixi: ['pixi.js'],
          monaco: ['monaco-editor'],
        },
      },
    },
  },
})
