# AGENTS.md

## UI 组件复用

When making UI or using components, always check if components from
`@antfu/design` can be reused, before making new components or creating
inline DOM elements.

## 项目约定

- 设计 token 来自 `@antfu/design`（`presetAnthonyDesign`）：用 `bg-base` / `color-base` / `color-muted` / `border-base` / `btn-action` 等语义 token，禁止在 UI 里硬编码十六进制色（玩家身份色 `--ja-p1`/`--ja-p2` 与游戏画布配色属于游戏领域数据，定义在 `src/styles/main.css`）。
- 层叠层级只用命名层（`z-hud` / `z-banner` / `z-dropdown`，定义在 `uno.config.ts`），preset 会拦截裸 `z-<n>`。
- `#game-wrap` 与 `#editor-panel` 两个 id 是引擎的 DOM 契约（Pixi 尺寸自适应、InputSystem 输入分流），不要改名。
- 界面文案一律走 `src/i18n` 消息目录（`t('a.b')`），不要在模板里硬编码中文。消息目录以 `messages/zh-CN.ts` 为事实源，`en-US.ts` 由类型约束强制补齐 —— 只加中文键会让 typecheck 失败。
- 引擎写给 UI 的状态位、控制台行、胜负横幅存**消息键 + 参数**（`msg()` / 玩家自由文本用 `rawMsg()`），不是成品字符串：模板渲染时才翻译，切语言能重译已显示的行。SDK 与渲染层报错只带错误码（`SdkError`，经 Worker 协议传回），文案在 `sdkErr.*` 目录里；Worker 侧不引 vue-i18n。
- 含 `{}` / `|` 的长文本（示例代码正文、SDK 文档 HTML）不要塞进消息目录 —— vue-i18n 的编译语法会误解析它们；这类内容按语言分文件放 `src/editor/`（`*.zh-CN.ts` / `*.en-US.ts`），逻辑必须逐行一致，只翻注释与文案。
- 拉丁语的字距/角标尺寸修正走 `html[lang^="en"]` 选择器（`src/styles/main.css`），不要给组件加语言条件 class。
- 提交前跑 `pnpm run ci`（lint + typecheck + build）。
