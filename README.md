# Joint Arena — 可编程关节格斗原型

[![CI](https://github.com/FliPPeDround/joint-arena/actions/workflows/ci.yml/badge.svg)](https://github.com/FliPPeDround/joint-arena/actions/workflows/ci.yml)
[![Deploy](https://github.com/FliPPeDround/joint-arena/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/FliPPeDround/joint-arena/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**中文** · [English](README.en.md)

Joint Arena 是一个「可编程关节格斗」Web 游戏原型：角色是白膜骨架，玩家不按预设招式按键，而是**写 JavaScript 代码从关节级别驱动自己的角色**——14 个关节就是 14 台可编程伺服马达，把它们协调起来，角色才能站稳、走动、出拳、踢腿、格挡。流程与大多数游戏一致：进入**大厅**（用户档案 + 预设网格）→ 选择**训练模式**（打机器人）或联机模式（暂未开放）→ 两具物理骨架在场地里互搏，99 秒内打空对方 100 点血即获胜；也可以进**编辑页**，左侧实时预览角色、右侧写代码，保存为预设。

> **在线试玩**：<https://flippedround.github.io/joint-arena/>（推送到 `main` 后由 GitHub Pages 自动部署）

## 界面预览

| 大厅 · 预设库 | 编辑页 · 实时预览 + Monaco |
| --- | --- |
| ![大厅](docs/images/lobby.png) | ![编辑页](docs/images/editor.png) |

| 对战 · 物理互搏 | 对战菜单（`ESC`） |
| --- | --- |
| ![对战](docs/images/battle.png) | ![对战菜单](docs/images/battle-menu.png) |


## 特性

- **游戏大厅**：用户档案（名字 / 战绩）、预设网格（每套代码一张按配色渲染的缩略图）、训练 / 联机模式选择。
- **编辑页实时预览**：单人沙盒引擎（无对手 / 无伤害 / 无倒计时），改代码立即看动作。
- **真物理骨架**：15 段刚体 + 14 个带限位的旋转关节（Rapier2D），没有动画帧，一切动作都是代码驱动的物理结果。
- **Web Worker 沙箱**：玩家代码运行在独立线程，死循环不会卡死游戏（600ms 看门狗自动终止），指令/日志有明确限额。
- **游戏级平衡辅助**：内建姿态维持系统（可调强度 0~1.6），站立时髋高锁在 82px、直立偏差 ≤1°、6 秒漂移 ≈1px —— 玩家不必从零实现「怎么站着」，专注出招策略。
- **完整战斗规则**：部位三分类（双手双脚攻击 / 手臂小腿防御可完全挡下 / 头·身体·屁股·大腿受击递减）、饱和接触力伤害（单次封顶）、命中点伤害数字特效、抬臂格挡（伤害 ×0.35）、按伤换算的硬直、封顶击退、倒地与起身、KO / 计时胜负。
- **Monaco 代码编辑器**：P1/P2 双模型、SDK 全局类型智能提示（`sdk.` 补全）、语法校验、亮/暗主题随系统切换。
- **外观自定义**：染色 / 图片贴图 / Canvas 绘制三种方式，应用内提供模板规格与模板 PNG 下载。
- **7 个内置示例**：从「站立 · 平衡」到「完整格斗 AI」，覆盖状态机、连段、防御与走位。
- **中英双语**：界面文案、状态提示、控制台、SDK 文档与示例代码都有 zh-CN / en-US 两份；语言选择存在 localStorage，
  切换即时生效（已挂出的横幅、HUD 状态、控制台里的引擎提示跟着变）。示例代码两种语言各一份，逻辑逐行一致——
  差异只在注释与 `sdk.log()` 文案，两边跑出来的是同一套 AI 行为。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 构建与语言 | Vite 7 + TypeScript 5.9 |
| UI 框架 | Vue 3.5（`<script setup>` + 响应式 store） |
| 国际化 | vue-i18n 11（`legacy: false`；消息目录以 zh-CN 为源，en-US 由类型约束强制对齐键） |
| 设计系统 | `@antfu/design`（UnoCSS `presetAnthonyDesign` token + 组件） |
| 代码编辑器 | Monaco Editor 0.57（language worker 经 Vite 打包，含 SDK 类型补全） |
| 渲染 | PixiJS 7.4 |
| 骨架动画运行时 | DragonBones 5.7（vendored 补丁版 `src/vendor/`，骨架数据由代码在运行时生成，不加载外部动画资源） |
| 2D 物理 | Rapier2D 0.21（WASM，`@dimforge/rapier2d-compat`） |
| 玩家代码沙箱 | Web Worker（ES module 格式，消息协议通信） |

## 快速开始

需要 **Node.js ≥ 22.20**（见 `.nvmrc`）与 **pnpm**。

```bash
git clone https://github.com/FliPPeDround/joint-arena.git
cd joint-arena
pnpm install
pnpm dev
```

打开 **http://127.0.0.1:5173**（Vite 配置固定监听 127.0.0.1:5173）。

> `pnpm install` 会触发 `prepare` 脚本（skills-npm），联网拉取一批 AI agent 用的 skills 到
> `.agents/skills/` 并建立各 IDE 的软链接。这些目录已被 `.gitignore` 忽略，与游戏本身无关；
> 离线环境用 `pnpm install --ignore-scripts` 跳过即可。

其他脚本：

```bash
pnpm build      # 类型检查（vue-tsc）+ 产出构建
pnpm preview    # 预览构建产物
pnpm typecheck  # 仅类型检查
pnpm lint       # ESLint（@antfu/eslint-config）
pnpm run ci         # lint + typecheck + build 一次跑完（与 CI 一致）
```

### 部署到子路径

构建基址默认是相对值 `./`，产物可直接用任意静态服务器托管。部署到子路径（如 GitHub Pages 的
`/<repo>/`）时注入绝对基址：

```bash
VITE_BASE=/joint-arena/ pnpm build
```

`.github/workflows/deploy-pages.yml` 已按此配置，并会生成 `404.html` 深链回退页与 `.nojekyll`。

## 玩法说明

1. **大厅（首页）**：进入游戏先是用户终端页 —— 左侧是用户档案（名字可改，场次 / 胜场 / 胜率随训练对战自动累计）与「开始游戏」「编辑角色」入口，右侧是**预设网格**：每张卡片是保存下来的一套角色代码，缩略图按代码里 `setPartColor` 的配色实时渲染。点击卡片选中，之后开战即用它。
2. **开始游戏**：弹出的模式选择里，**训练模式** = 与内建格斗 AI（07 示例）对练，使用选中预设的代码；**联机模式**为与其他玩家对战，暂未开放。
3. **编辑页**：从「编辑角色」或预设卡片的编辑按钮进入 —— 左侧是该角色的**实时预览**（单人沙盒：无对手、无伤害、无回合倒计时），右侧是代码编辑器（输入 `sdk.` 有补全）、SDK 文档、纹理与设置页签。顶部可改名并「保存预设」（内置示例保存时会自动复制成自己的副本）。左上角「大厅」返回。
4. **对战页**：整幅格斗舞台（血条 + 回合计时 + 特效），快节奏对战不提供代码编辑；右下角「ESC 菜单」按钮（或按 `ESC`）呼出**对战菜单**：继续对战 / 重新开始 / 对战设置（调试视图开关、按键绑定）/ 返回大厅。菜单不暂停战斗，战场在幕布后继续。
5. **写代码**：代码在**编辑页**里写（P1 单人预览 + 控制台），保存在浏览器 localStorage，刷新不丢；训练模式的对手固定为内建格斗 AI。按键在玩家代码里用 `sdk.bindKey` / `sdk.isKeyDown` 定义。
6. **▶ 运行 / ■ 停止 / ↺ 重置回合**（编辑页）：启动（或重启）角色逻辑并重置回合；停止终止逻辑；重置复位骨架、血量与计时（也可用来从错误暂停中恢复）。对战菜单里的「重新开始」= 重载双方代码并重置回合。
7. **内置预设**：首次进入自动播种 7 个示例（站立 / 走路 / 出拳 / 踢腿 / 格挡 / 换肤 / 完整格斗 AI），覆盖状态机、连段、防御与走位，可在网格里复制后修改。
8. **控制台**：`sdk.log()` 的输出、运行时错误、命中提示都打印在这里。
9. **设置**：编辑页「设置」页签与对战菜单「对战设置」里，都可以开关调试视图（碰撞体 / 关节与角度 / 骨骼 / 射线）、查看已绑定按键、切换界面语言（中文 / English）；大厅左上角字标旁也有同一个语言开关。

## 目录结构

```
joint-arena/
├── index.html                  # Vue 挂载点（#app）
├── vite.config.ts              # Vue/UnoCSS 插件、固定 127.0.0.1:5173、ES Worker、monaco/pixi 分包、VITE_BASE 子路径部署
├── uno.config.ts               # presetAnthonyDesign + wind4 + 图标/字体，token 化 UI
├── eslint.config.js            # @antfu/eslint-config（antislop）
├── .github/workflows/          # CI（lint/typecheck/build）+ GitHub Pages 部署
├── docs/                       # 文档（上手 / SDK / 骨架 / 纹理）与界面截图 docs/images/
└── src/
    ├── main.ts                 # Vue 应用入口：挂载 App，引 UnoCSS/reset/设计系统样式
    ├── App.vue                 # 顶层视图外壳：大厅 / 编辑页 / 对战页切换（out-in 过渡）
    ├── i18n/                   # vue-i18n 装配：index.ts（locale 持久化 + t / 消息键 / DisplayMsg）、messages/zh-CN.ts（事实源）、messages/en-US.ts
    ├── views/
    │   ├── LobbyView.vue       # 大厅：用户档案 + 预设网格 + 开始游戏（模式选择弹层）
    │   ├── EditorView.vue      # 编辑页：单人预览引擎（solo）+ 代码/文档/纹理/设置面板
    │   └── BattleView.vue      # 对战页：整幅游戏画布 + HUD + 对战菜单弹层，训练模式自动开局
    ├── engine/game.ts          # 游戏引擎装配：初始化、指令落地、快照、回合控制、solo 预览、dispose、__JA 测试钩子
    ├── stores/
    │   ├── game.ts             # 响应式 store：HUD / 控制台 / 状态 / 双方代码（localStorage 持久化）
    │   ├── profile.ts          # 用户档案：名字 + 战绩（localStorage）
    │   ├── presets.ts          # 预设 CRUD / 选中态 / 内置示例播种（localStorage）
    │   └── ui.ts               # 顶层视图状态与导航动作（startTraining / openEditor / goLobby）
    ├── editor/presetThumb.ts   # 预设缩略图：静止姿态白膜骨架 + 代码配色渲染到 canvas
    ├── monaco/                 # Monaco 接入：worker 打包入口、ja-dark 主题、SDK 类型补全、P1/P2 模型
    ├── components/
    │   ├── PresetThumb.vue     # 预设卡片缩略图 canvas
    │   ├── LanguageSwitch.vue  # 语言切换（中文 / English，复用 @antfu/design ActionToggleGroup）
    │   ├── HudOverlay.vue      # 血条 / 回合计时 / 状态标签
    │   ├── RoundBanner.vue     # KO / 胜负横幅
    │   ├── BattleMenu.vue      # 对战菜单弹层（继续 / 重开 / 设置 / 返回大厅，ESC 呼出）
    │   └── editor/             # EditorPanel（标签页）、CodeTab、CodeEditor（Monaco 封装）、
    │                           # ConsolePanel、DocsTab、TextureTab、SettingsTab
    ├── editor/                 # 数据与纯函数：examples.ts（示例选择 API + botCode()/starterCode()，正文在 examples.{zh-CN,en-US}.ts）、
    │                           # sdkDocs.ts + sdkDocs.{zh-CN,en-US}.ts、sdkDts.ts、texturePreview.ts
    ├── combat/combatSystem.ts  # 战斗规则：伤害/格挡/硬直/击退/倒地/KO/计时胜负
    ├── core/utils.ts           # 角度换算（世界角↔DragonBones 角）、几何工具
    ├── input/inputSystem.ts    # 键鼠输入采集（换算到世界坐标）
    ├── physics/                # physicsWorld.ts（Rapier 世界）+ fighterBody.ts（15 刚体/14 关节/马达/平衡辅助）
    ├── render/                 # gameApp.ts（场景/相机）、fighterView.ts（物理→骨架姿态同步、换肤）、debugView.ts
    ├── sdk/                    # Worker 沙箱：protocol.ts（协议）、sandboxHost.ts（宿主）、worker.ts、workerSdk.ts（SDK 实现）、sdkError.ts（错误码）
    ├── skeleton/               # partDefs.ts（部件/关节/静止姿态权威定义）、whiteboxAtlas.ts（白膜图集）、skeletonData.ts（DragonBones JSON 生成）
    ├── styles/                 # 全局样式（领域色 / 文档排版 / 横幅与视图过渡）
    ├── types/                  # DragonBones API 类型声明
    └── vendor/                 # vendored DragonBones 5.7 运行时（补丁版 ES bundle + 类型化门面）
```

## 架构说明（Vue 重构版）

引擎与 UI 单向数据流：

- **视图流程**：`stores/ui.ts` 持有顶层视图（`lobby / editor / battle`），`App.vue` 按 `mode="out-in"` 过渡切换 —— 旧视图先卸载（引擎 `dispose()` 释放 Worker / 渲染循环 / 监听，DOM 契约 id 让位），新视图再挂载。
- **引擎 → UI**：`src/engine/game.ts` 每帧把 HP / 回合时间 / 状态写入 `stores/game.ts` 的响应式 store；沙箱日志与状态同步写入。Vue 组件只读 store 渲染（同值赋值不触发副作用，每帧写很廉价）。分出胜负时引擎写入 `matchWinner` 并累计到 `stores/profile.ts` 的用户档案。
- **UI → 引擎**：引擎装配后把操作接口（run / stop / reset / dispose / 调试开关 / 部件染色预览 / 图集查询）写入 `gameApi`，组件通过它驱动引擎。`createGame(canvas, { solo })` 的 `solo` 模式只渲染 P1、停用战斗规则，供编辑页做角色预览。
- **预设**：`stores/presets.ts` 管理预设（首次进入播种 7 个内置示例）；大厅选中的预设决定训练模式的 P1 代码（P2 固定为内建格斗 AI `botCode()`）；Monaco 模型与 `codes` store 双向同步。内置预设的名字与代码属于内容，换语言时自动重新同步，用户自建预设原样保留。
- **代码编辑**：P1/P2 各一个 Monaco 模型，内容变更写入 `codes` store，store watcher 持久化到 localStorage；运行时引擎从 `codes` 取代码喂给沙箱。
- **国际化**：`src/i18n` 持有 vue-i18n 实例（`legacy: false`）与 `joint-arena.locale` 持久化，切语言时同步 `<html lang>` 与 `document.title`。消息目录以 `messages/zh-CN.ts` 为事实源，`en-US` 由类型约束强制对齐键。引擎写入 store 的状态位、控制台行、胜负横幅存的是**消息键 + 参数**而非成品字符串，模板渲染时才取文案，所以切语言即时重译；玩家 `sdk.log()` 的自由文本按原文显示。SDK 与渲染层的报错只带**错误码 + 参数**（`SdkError` 经 Worker 协议传回宿主），由目录出文案 —— Worker 侧不需要 i18n 实例。拉丁语的字距修正在 `styles/main.css`（`html[lang^="en"] .i18n-display`）。
- 保留的 DOM 契约：`#game-wrap`（Pixi 自适应尺寸，三个视图都有）与 `#editor-panel`（编辑页右侧面板，InputSystem 判断按键来自编辑器还是游戏）两个 id 不要改名（一次只存在一个实例）。

## 里程碑 M0–M6 对照

全部里程碑已实现，并经过浏览器自动化（GUI 黑盒）验证；UI 层已完成 Vue 3 + Monaco Editor 重构。

| 里程碑 | 内容 | 状态 |
| --- | --- | --- |
| M0 | 渲染管线验证：运行时生成 DragonBones 骨架 JSON 与白膜图集，`?mode=m0` 无物理正弦驱动演示 | 已实现 |
| M1 | 物理骨架：Rapier 15 刚体 + 14 限位旋转关节、碰撞分组、静止姿态稳定站立 | 已实现 |
| M2 | 物理→渲染同步：世界坐标 y 翻转、角度换算与镜像公式、调试视图（碰撞体/关节角/骨骼/射线） | 已实现 |
| M3 | SDK 沙箱：Web Worker + 消息协议、快照/指令缓冲、单帧 500 指令与日志限流、600ms 看门狗、连续错误暂停 | 已实现 |
| M4 | 编辑器：Monaco 双模型（P1/P2）、7 个示例、控制台、应用内 SDK 文档、设置页 | 已实现（Vue 重构版） |
| M5 | 战斗系统：接触力伤害公式、抬臂格挡、硬直、击退、倒地/起身、KO 与计时胜负、HUD 与回合控制 | 已实现 |
| M6 | 体验完善：三方式纹理自定义、纹理模板 PNG 下载、平衡辅助可调（`__JA.tune`）、完整格斗 AI 示例、端到端浏览器自动化回归 | 已实现 |

## 平衡辅助标定（站立与移动的地基）

角色是纯物理布娃娃，能站稳全靠 `BALANCE`（`src/physics/fighterBody.ts`）里那套姿态维持系统。它的参数**必须按体重标定**，否则角色站不住、预设怎么写都像瘫子：

- 全体重 `m·g = 5.2kg × 2200 = 11440`。悬停弹簧的静息下陷 = `m·g / kH`，所以 `kH` 要**明显强于**体重：`kH=6000` → 下陷约 2px（髋高 84→82）。
- 旧值 `kH=600` 配 `maxFUp=11500` 只有刚好托住体重的余量：静息下陷 19px（84→65），膝链被压塌成蹲姿，直立回复力也压不住 —— 实测**连内建锁姿站立都在 3 秒内漂到 25°、髋高掉到 78**，玩家预设只能靠「低重心滑步」这类补丁勉强走两步。
- 修正后：站立髋高 82px、直立偏差 ≤1°、6 秒漂移 ≈1px；行走时髋高稳定在 82（旧值 65），支撑脚打滑量约为髋速的 15%。

另一处关键细节：悬停/水平的**阻尼都参考「本帧期望速度」**（`rootVelTarget`），站着时是 0，一旦玩家发出 `setRootVelocity` 就让开。否则阻尼会与移动指令对拉 —— 实测把行走距离从 208px 压到 9px（走不动），也会把跳跃吃掉（起跳只剩 2px）。

## M0 演示模式

访问 **http://127.0.0.1:5173/?mode=m0** 进入 M0 演示：不启动物理与玩家代码，两个角色由关节角正弦函数驱动（P2 相位偏移 1.2s），用于单独验证 DragonBones 渲染管线与「物理角→骨架角」同步数学。正常模式（不带参数）则运行完整游戏循环。

## 测试与自动化钩子（window.__JA）

页面在浏览器控制台暴露 `window.__JA`，供自动化脚本与调参实验使用：

| 钩子 | 说明 |
| --- | --- |
| `run()` / `stop()` / `reset()` | 等价于「▶ 运行」/「■ 停止」/「↺ 重置回合」 |
| `pressKey(key, durationMs=120)` | 合成一次按键按下/抬起（如 `__JA.pressKey('j')`） |
| `state()` | 双方 hp / 状态 / 髋部坐标、回合剩余时间、胜者 |
| `physics()` | 双方髋部位置与直立偏差角、关键部件刚体中心 |
| `joints(id)` | 某角色 14 关节语义角（度）+ 髋高 `__hipY` + 平衡强度 `__bs` |
| `jointInfo(id, joint)` | 单关节详情：限位是否启用、min/max、Rapier 角与语义角 |
| `root(id)` | 根部控制状态：setRootVelocity 目标、applyRootForce、平衡强度、髋部水平速度 |
| `combat()` | 战斗诊断：接触对计数、最大接触力、命中记录 |
| `tune(gains)` | 直接改写平衡辅助参数 `BALANCE`（如 `__JA.tune({ kH: 6000 })`） |
| `lab.stand()` | 停掉沙箱，用内建马达锁定标准站立姿态（隔离实验） |
| `lab.ragdoll()` | 清空马达、平衡归零（纯布娃娃） |
| `arm` | P1 的 DragonBones 骨架对象（渲染层调试） |
| `forceSync()` / `renderDbg(id)` | 强制姿态同步 / 读取精灵变换与姿态快照 |
| `jointProto(id)` | 列出 Rapier 关节对象原型链上的全部方法名 |

另：主循环若抛异常，完整堆栈会存到 `window.__loopErr`。

## 更多文档

> 以下 `docs/` 文档与 [CONTRIBUTING.md](CONTRIBUTING.md) 目前只有中文；游戏内的「SDK 文档」标签页有中英两份。

- [docs/QUICKSTART.md](docs/QUICKSTART.md) — 十分钟上手：写出一个会追着对手出拳的角色
- [docs/SDK.md](docs/SDK.md) — 完整 SDK API 参考（与游戏内「SDK 文档」标签页一致）
- [docs/SKELETON.md](docs/SKELETON.md) — 白膜骨架规范（部件表、关节限位、坐标约定）
- [docs/TEXTURE_TEMPLATE.md](docs/TEXTURE_TEMPLATE.md) — 纹理自定义指南与模板规格
- [CONTRIBUTING.md](CONTRIBUTING.md) — 环境要求、提交前自检、代码约定与目录导航

## 许可证

[MIT](LICENSE) © FliPPeDround

第三方依赖均为宽松许可：Rapier2D（Apache-2.0）、PixiJS / DragonBones / Monaco / Vue（MIT）。
`src/vendor/dragonBones.esm.js` 是 `pixi-dragonbones@5.7.0-1` 的 ESM 补丁版，许可证头已保留在文件内。
