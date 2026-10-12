import { presetAnthonyDesign } from '@antfu/design/unocss'
import transformerDirectives from '@unocss/transformer-directives'
import {
  defineConfig,
  presetIcons,
  presetWebFonts,
  presetWind4,
} from 'unocss'

export default defineConfig({
  // presetAnthonyDesign 禁止裸 z-<n>，所有层叠层级必须用具名层
  shortcuts: {
    'z-hud': 'z-[10]',
    'z-banner': 'z-[20]',
    'z-dropdown': 'z-[40]',
    'z-tooltip': 'z-[45]',
  },
  presets: [
    presetAnthonyDesign(),
    presetWind4(), // 基础 preset 必需 —— 语义 shortcut 展开为它的 utilities
    presetIcons({
      scale: 1.2,
      warn: true,
    }),
    presetWebFonts({
      // 全部使用系统字体栈：游戏为本地离线运行，不拉取在线字体。
      // display = 大厅菜单的展示字体：拉丁走 DM Serif，中文落到系统宋体（书法菜单的骨架）
      provider: 'none',
      fonts: {
        sans: 'DM Sans, PingFang SC, Microsoft YaHei, system-ui, sans-serif',
        serif: 'DM Serif Display, PingFang SC, Microsoft YaHei, serif',
        mono: 'DM Mono, ui-monospace, Menlo, Consolas, monospace',
        display: 'DM Serif Display, Songti SC, STSong, SimSun, Noto Serif CJK SC, serif',
      },
    }),
  ],
  // @antfu/design 自带 CSS 使用 --uno 指令做 token 化着色，需要该 transformer 展开
  transformers: [transformerDirectives()],
})
