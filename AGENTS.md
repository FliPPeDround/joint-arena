# AGENTS.md

## UI 组件复用

When making UI or using components, always check if components from
`@antfu/design` can be reused, before making new components or creating
inline DOM elements.

## 项目约定

- 设计 token 来自 `@antfu/design`（`presetAnthonyDesign`）：用 `bg-base` / `color-base` / `color-muted` / `border-base` / `btn-action` 等语义 token，禁止在 UI 里硬编码十六进制色（玩家身份色 `--ja-p1`/`--ja-p2` 与游戏画布配色属于游戏领域数据，定义在 `src/styles/main.css`）。
- 层叠层级只用命名层（`z-hud` / `z-banner` / `z-dropdown`，定义在 `uno.config.ts`），preset 会拦截裸 `z-<n>`。
- `#game-wrap` 与 `#editor-panel` 两个 id 是引擎的 DOM 契约（Pixi 尺寸自适应、InputSystem 输入分流），不要改名。
- 提交前跑 `pnpm run ci`（lint + typecheck + build）。
