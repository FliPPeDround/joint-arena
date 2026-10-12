# 贡献指南

感谢你有兴趣改进 Joint Arena。这是一个玩法原型项目，代码风格与约定比较统一，改动前建议先读一遍 [AGENTS.md](AGENTS.md) 与本文。

## 环境要求

- **Node.js ≥ 22.20.0**（`engines` 与 `.nvmrc` 已固定；`skills-npm` 的 `prepare` 脚本要求此下限）
- **pnpm**（仓库由 pnpm workspace catalog 管理依赖版本）

```bash
nvm use            # 读取 .nvmrc
pnpm install       # 会自动执行 prepare（同步 agent skills）
pnpm dev           # http://127.0.0.1:5173
```

> `pnpm install` 的 `prepare` 脚本（skills-npm）会联网拉取一批 AI agent 用的 skills 到
> `.agents/skills/` 并生成各 IDE 的软链接。这些目录已被 `.gitignore` 忽略，与游戏无关；
> 离线环境可用 `pnpm install --ignore-scripts` 跳过。

## 提交前自检

```bash
pnpm run ci    # = lint + typecheck + build，与 CI 完全一致
```

PR 必须让 `pnpm run ci` 通过。CI 会在 `push` 到 `main` 与所有 PR 上运行同一套检查。

## 代码约定（要点）

- **设计 token**：UI 一律用 `@antfu/design` 的语义 token（`bg-base` / `color-base` / `color-muted` / `border-base` / `btn-action` 等），
  不要在组件里硬编码十六进制色。例外是游戏领域数据——玩家身份色 `--ja-p1` / `--ja-p2` 与画布配色，它们定义在 `src/styles/main.css`。
- **组件复用**：写新 UI 前先看 `@antfu/design` 是否已有可复用组件，避免重复造轮子或堆裸 DOM。
- **层级**：只用命名层 `z-hud` / `z-banner` / `z-dropdown`（见 `uno.config.ts`）；UnoCSS preset 会拦截裸 `z-<n>`。
- **DOM 契约**：`#game-wrap` 与 `#editor-panel` 两个 id 被引擎依赖（Pixi 尺寸自适应、InputSystem 输入分流），**不要改名**。
- **样式**：遵循 `@antfu/eslint-config`，不写分号、单引号、2 空格缩进。

## 目录导航

改动通常落在这些位置：

| 想改什么 | 去哪 |
| --- | --- |
| 战斗伤害 / 格挡 / 硬直 / KO 规则 | `src/combat/combatSystem.ts` |
| 角色刚体、关节限位、平衡辅助（`BALANCE`） | `src/physics/fighterBody.ts` |
| 姿态维持参数标定原理 | README「平衡辅助标定」一节 |
| 玩家 SDK / 沙箱协议 | `src/sdk/`（`workerSdk.ts` 是 SDK 实现，`protocol.ts` 是消息协议） |
| 内置示例（7 个）与机器人 AI | `src/editor/examples.ts` |
| SDK 文档（游戏内页签） | `src/editor/sdkDocs.ts`；对外版本见 `docs/SDK.md` |
| 骨架部件 / 关节定义 | `src/skeleton/partDefs.ts`（权威定义） |

## 调参与调试

浏览器控制台暴露 `window.__JA` 钩子，用于实测调参而非凭感觉改数值，例如：

```js
__JA.state() // 双方 HP / 状态 / 髋部坐标 / 回合时间
__JA.joints('P1') // 14 关节语义角 + 髋高
__JA.tune({ kH: 6000 }) // 现场改平衡辅助参数
__JA.lab.stand() // 停掉沙箱，用内建马达锁定标准站立姿态（隔离实验）
```

完整清单见 README「测试与自动化钩子」一节。改动物理或平衡参数时，请贴出改动前后的 `__JA` 实测数据。

## 文档

用户可见的行为变化请同步更新对应文档：

- `README.md` — 总览、玩法、架构
- `docs/QUICKSTART.md` — 十分钟上手
- `docs/SDK.md` — SDK API 参考（与 `src/editor/sdkDocs.ts` 保持一致）
- `docs/SKELETON.md` — 骨架规范
- `docs/TEXTURE_TEMPLATE.md` — 纹理自定义

## 许可证

提交的贡献将以 [MIT License](LICENSE) 授权。
