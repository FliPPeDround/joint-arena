# Joint Arena SDK 参考

本文档与游戏内「SDK 文档」标签页（`src/editor/sdkDocs.ts`）内容一致，并补充了细节。

玩家代码运行在 **Web Worker 沙箱**中，与游戏主线程通过消息通信。代码里唯一可用的入口是全局对象 **`sdk`**。没有 DOM / window / document；死循环不会卡死游戏，但该角色逻辑会被看门狗自动终止。

## 坐标与角度约定

- 世界坐标：x 向右，**y 向上**，地面 y=0，单位 = 像素。重力 -2200 px/s²，场地半宽 950（两侧有墙）。
- 关节角：**0° = 静止姿态**（双臂自然下垂站立）。正方向以角色朝向为准：肩/髋向前抬为正，肘/膝弯曲为正；脊柱/颈正 = 后仰/抬头（负 = 前躬/低头），踝正 = 勾脚尖。
- 部件朝向：部件轴从「轴心」指向「末端」。自然下垂的四肢轴朝下，头的轴心在头顶、轴朝下（指向颈部）。
- P1 出生在左侧、面朝右；P2 在右侧、面朝左。所有角度语义永远相对**自己**的面朝方向。

## 生命周期

| API | 说明 |
| --- | --- |
| `sdk.onInit(cb)` | 代码加载完成后调用一次。此时还不能读游戏状态（快照未生成），但可以发出写指令（如染色） |
| `sdk.onTick(cb(dt))` | 每物理帧调用（60Hz），`dt` 为帧间隔（秒）。推荐在每帧重复发送关节马达指令 |
| `sdk.onEvent(cb(e))` | 事件回调，见下方[事件类型表](#事件类型表) |
| `sdk.onDestroy(cb)` | 代码被停止时调用 |

## 统一部件 key（sdk.P）

行动（关节驱动）、外观（颜色 / 贴图）、传感器（坐标 / 接触 / 射线）**共用同一套部件 key**，推荐用枚举 `sdk.P.*`，不要手写字符串：

| 枚举 | 部件名 | 枚举 | 部件名 |
| --- | --- | --- | --- |
| `sdk.P.HIP` | `hip` | `sdk.P.TORSO` | `torso` |
| `sdk.P.HEAD` | `head` | `sdk.P.UPPERARM_R` / `_L` | `upperarm_R` / `_L` |
| `sdk.P.FOREARM_R` / `_L` | `forearm_R` / `_L` | `sdk.P.HAND_R` / `_L` | `hand_R` / `_L` |
| `sdk.P.THIGH_R` / `_L` | `thigh_R` / `_L` | `sdk.P.SHIN_R` / `_L` | `shin_R` / `_L` |
| `sdk.P.FOOT_R` / `_L` | `foot_R` / `_L` | | |

枚举值就是部件名字符串（`sdk.P.FOREARM_R` 即 `'forearm_R'`）。**动作作用于该部件绕父部件的旋转**：`P.FOREARM_R` = 弯肘、`P.SHIN_R` = 弯膝、`P.TORSO` = 弯腰、`P.HEAD` = 转头；`P.HIP` 是根部件，没有驱动关节（移动用 `setRootVelocity` / `applyRootForce`）。

## 关节控制（统一部件 key）

| API | 说明 |
| --- | --- |
| `setJointMotor(part, targetAngle, speed=360, maxTorque?)` | 伺服马达：以限速 `speed`（度/秒，最小 30）把 part 转向目标角；目标角自动夹到限位内；`maxTorque` 限制力量（省略则用默认值） |
| `setJointAngle(part, angle)` | 刚性设角（高刚度伺服：speed 720、maxTorque = 默认 ×2.2） |
| `rotateJoint(part, deltaAngle)` | 从当前角旋转相对量（沿用当前 speed / maxTorque） |
| `getJointAngle(part)` | 读当前角度（度，0 = 静止姿态） |
| `setJointTorque(part, torque)` | 直接施加扭矩，**仅当帧有效**，需要每帧调用；正 = 语义正方向 |
| `setJointLimits(part, min, max)` | 收窄角度限位（不能超出解剖硬限位；max < min 时忽略） |

提示：

- 每帧重复调用 `setJointMotor` 是推荐用法（PD 伺服需要持续指令）。
- `maxTorque` 是引擎内部量纲，参考量级：手臂类数百~数千（出拳/踢腿瞬间可给 4000~6000）、脊柱 3 万、腿 30 万、踝 18 万。
- 写指令可以在任意回调里发（`onInit` / `onTick` / `bindKey` / `onEvent`），会在当帧末尾统一生效。

### 关节限位表

部件 key 按连接关系列出（括号内为解剖学关节名，对应 SKELETON.md 里的内部关节）：

| 部件 key | 连接（父 → 子） | 限位（度） | 语义 |
| --- | --- | --- | --- |
| `P.TORSO`（腰） | hip → torso | [-30, 30] | 0 = 直立；正 = 后仰，负 = 前躬 |
| `P.HEAD`（颈） | torso → head | [-45, 45] | 0 = 平视；正 = 抬头，负 = 低头 |
| `P.UPPERARM_R` / `_L`（肩） | torso → upperarm | [-40, 170] | 0 = 垂臂；正 = 前抬（可举过头顶），负 = 后摆 |
| `P.FOREARM_R` / `_L`（肘） | upperarm → forearm | [0, 150] | 0 = 伸直；正 = 弯曲 |
| `P.HAND_R` / `_L`（腕） | forearm → hand | [-45, 45] | 0 = 与前臂平齐；正 = 手向前翘 |
| `P.THIGH_R` / `_L`（髋） | hip → thigh | [-45, 130] | 0 = 站立；正 = 前抬腿，负 = 后摆 |
| `P.SHIN_R` / `_L`（膝） | thigh → shin | [0, 150] | 0 = 伸直；正 = 弯曲 |
| `P.FOOT_R` / `_L`（踝） | shin → foot | [-45, 45] | 0 = 脚掌放平；正 = 勾脚尖，负 = 绷脚尖 |

## 骨骼与传感器

可用部件 key（`sdk.P` 枚举，值 = `sdk.PARTS` 数组）：`hip · torso · head · upperarm_R · forearm_R · hand_R · upperarm_L · forearm_L · hand_L · thigh_R · shin_R · foot_R · thigh_L · shin_L · foot_L`

以下读操作都基于主线程推送的**最近一帧快照**（同步、零往返），因此只能在 `onTick` / 事件回调中使用；在 `onInit` 里调用会抛「游戏尚未开始」。

| API | 说明 |
| --- | --- |
| `getBonePosition(part)` | 部件轴心世界坐标 `{x, y}` |
| `getBoneVelocity(part)` | 部件速度 `{x, y}`（px/s） |
| `getBoneRotation(part)` | 部件轴的角度（度，世界系） |
| `getOpponentBonePosition(part)` | 对手部件轴心坐标 |
| `getDistanceTo(part \| 'opp:head')` | 自己躯干轴心到目标部件轴心的直线距离；传自己的部件名或 `'opp:部件名'` |
| `getContacts(part)` | 接触列表，如 `'ground'` / `'wall_L'` / `'P2:head'` |
| `raycast(origin, direction, distance)` | 射线检测，见下 |

### raycast 返回结构

```js
const hit = sdk.raycast(
  sdk.getBonePosition(sdk.P.HAND_R), // origin: {x, y}
  { x: 1, y: 0 },                    // direction: 会自动归一化
  300,                               // distance: 上限（会被夹到 1~800）
);
// hit = { hit: boolean, distance: number, point: {x, y}, part: string }
```

- `part` 取值：`'ground'` / `'wall_L'` / `'wall_R'` / `'self:部件名'` / `'opp:部件名'`；未命中时 `part` 为空字符串。
- 对双方部件用胶囊近似（半径 = 部件宽度的一半），对地面/墙做解析求交。
- 每次调用会向调试层发送一条射线（设置页可关闭「射线」显示）。

## 输入

按键名 = `KeyboardEvent.key` 的小写形式：字母 `'a'`、方向键 `'arrowleft'`、空格 `' '`。`bindKey` 绑定的键会显示在「设置」标签页的按键绑定列表里；同一个键可以绑定多个回调。

| API | 说明 |
| --- | --- |
| `bindKey(key, cb)` | 按键按下回调（事件驱动；抬起不触发） |
| `bindMouse(button, cb)` | 鼠标按下回调（`'left'|'middle'|'right'` 或 0/1/2） |
| `isKeyDown(key)` | 按键状态查询（在 `onTick` 中轮询） |
| `isMouseDown(button)` | 鼠标按键状态查询 |
| `getMousePosition()` | 鼠标世界坐标 `{x, y}` |

## 纹理与外观

| API | 说明 |
| --- | --- |
| `setPartColor(part, '#4f8cff' | 0x4f8cff)` | 染色（乘法 tint），可随时调用 |
| `setPartTexture(part, url)` | 图片贴图（PNG/JPG/WebP，最长边 ≤1024，拒绝 SVG，跨域图片需服务器开 CORS） |
| `createCanvas(w, h)` | 创建 OffscreenCanvas（沙箱内无 DOM），`w×h ≤ 1024×1024` |
| `setPartTextureFromCanvas(part, canvas)` | Canvas 贴图（canvas 必须由 `sdk.createCanvas` 创建；建议部件尺寸 ×4） |
| `setPartScale(part, sx, sy)` | 缩放（1 = 原始大小） |
| `setPartOffset(part, ox, oy)` | 偏移：`ox` 沿部件轴（正 = 向末端），`oy` 朝面朝方向（正 = 面朝侧） |
| `resetPart(part)` | 恢复默认白膜（贴图/染色/缩放/偏移全部复位） |

贴图画布规格：宽 = 部件宽 ×4，高 = 部件长 ×4，锚点在顶边中点；内容竖直向下延伸，渲染时随部件旋转；画布 +x 侧对应角色面朝方向。自定义贴图按 4× 模板分辨率渲染（用其他尺寸时显示大小 = 贴图像素 ÷ 4）。详见 [TEXTURE_TEMPLATE.md](TEXTURE_TEMPLATE.md)。

## 工具与扩展

| API | 说明 |
| --- | --- |
| `log(obj)` / `logWarn(obj)` | 输出到控制台；`log` 每帧限 8 条（超出丢弃），`logWarn` 不限 |
| `getTime()` / `getDeltaTime()` | 累计时间（秒）/ 上一帧间隔 |
| `getHp()` / `getOpponentHp()` | 自己 / 对手血量（0~100） |
| `getSelfState()` | `{ hp, state, facing }` |
| `getOpponentState()` | `{ hp, state, facing, torso: {x, y} }` |
| `getRoundTime()` | 回合剩余时间（秒） |
| `setBalanceStrength(v)` | 平衡辅助强度 0~1.6（超出会被夹到边界），默认 1；见下文 |
| `setRootVelocity(vx, vy)` | 根部速度控制（推荐移动方式），持续有效直到再次设置或 `stopMoving()` |
| `stopMoving()` | 等价 `setRootVelocity(0, 0)` |
| `applyRootForce(fx, fy)` | 对髋部直接施力，**仅当帧有效** |
| `sdk.P` | 统一部件枚举（行动 / 外观 / 传感器共用，见[统一部件 key](#统一部件-key-sdkp)） |
| `sdk.P` / `sdk.PARTS` | 统一部件枚举（见[统一部件 key](#统一部件-keysdkp)）/ 部件名数组 |

## 事件类型表

`sdk.onEvent(cb)` 收到的事件（`e.type` 区分）：

| type | 载荷 | 触发时机 |
| --- | --- | --- |
| `roundStart` | – | 点「▶ 运行」或「↺ 重置回合」后 |
| `roundEnd` | `winner: 'P1' \| 'P2' \| 'draw'` | 一方 HP 归零或 99s 计时结束 |
| `hit` | `damage, from, dir` | 自己被击中；`dir` 为击退方向（+1 = 向 +x） |
| `dealHit` | `damage, to` | 自己的攻击命中对手 |
| `stateChange` | `state: 'normal' \| 'stun' \| 'down' \| 'ko'` | 状态切换时（硬直开始 / 硬直恢复 / 倒地） |
| `keydown` / `keyup` | `key` | 任意按键（不限于 bindKey 绑定的） |
| `mousedown` / `mouseup` | `button, x, y` | 鼠标按下 / 抬起（x,y 为世界坐标） |
| `mousemove` | `x, y` | 鼠标移动 |

## 战斗规则速查

写 AI 前值得知道的规则（详见 `src/combat/combatSystem.ts`）：

- **伤害**：`伤害 = clamp(round(饱和基 × 攻击部件打击倍率 × 受击部件受伤倍率 × 速度系数 × 格挡系数), 格挡可 0 / 否则 1~12)`。饱和基 `= 6 × 超力 / (超力 + 7000)`，超力 `= 接触力 − 4200`。接触力 ≤ 4200，或攻击/受击部件相对速度 < 180px/s（慢速推挤），都不结算。攻击部件取接触双方中打击倍率高者（都为 0 则无伤害）。
- **打击/受伤倍率**：手 1.5、脚 1.2；受伤按头 2.0 > 身体 1.0 > 屁股 0.8 > 大腿 0.6，防御部位（手臂/小腿）受伤 0.1。
- **格挡**：受击者**双前臂轴都接近竖直向上**（偏差 < 60°）**且手腕高于髋部**（> 髋中心 +10px）时，伤害 ×0.35；防御部位/格挡可把伤害挡到 0（飘"挡"字，不扣血不断招）。
- **冷却**：同一攻击部件对同一角色 0.45s 只结算一次伤害；受击者另有 0.12s 无敌帧（防多肢同帧叠伤）。
- **硬直**：受击进入 `stun`，时长 `= min(0.35, 0.16 + 伤害 × 0.014)`（轻蹭约 0.17s、重拳约 0.27s），期间关节马达力量 ×0.12、平衡辅助 ×0.15。
- **击退**：命中后按伤害对受击者髋/躯干施加冲量（`min(1500, 伤害 × 110)`）。
- **倒地**：髋部偏离直立 > 70° 或髋部中心低于 40px 持续 0.5s 进入 `down`（马达 ×0.6、平衡 ×0.3，仍可挣扎起身）；躯干回到直立 30° 内即恢复 `normal`。
- **KO / 胜负**：HP ≤ 0 即 `ko`（马达清零、无法行动）；双方同时归零为平局；99s 计时结束时血量高者胜，相同为平局。

## 平衡辅助与根部移动（游戏级辅助系统）

Joint Arena 的骨架是纯物理布娃娃，为了让「写格斗逻辑」而不是「写站姿控制器」成为玩家的主要工作，游戏内建了一套**姿态维持系统**（平衡辅助）和**根部移动辅助**。它们是游戏级规则，不属于任何一个关节。

### setBalanceStrength(0 ~ 1.6)

平衡辅助对髋部持续施加三类效果：直立回复扭矩（把躯干扶正）、悬停支撑力（如弹簧支柱托住体重，腿部只负责摆位）、水平回复力与速度阻尼（把髋部稳在重心上方）。默认强度 1，0 = 关闭（纯布娃娃），最大 1.6（格挡、起身时可临时调高）。

调好的辅助能让角色稳定站稳：站立时髋高锁在 82px、直立偏差 ≤1°、6 秒漂移 ≈1px。所以**你不需要自己写站姿控制器**——直接下 `setRootVelocity` 与关节指令即可。注意水平/垂直阻尼都参考「本帧期望速度」：站着时是 0（抗漂移抗下沉），一旦你发出 `setRootVelocity` 指令就让开，不会和移动对拉。

状态会自动削弱辅助：`stun` ×0.15、`down` ×0.3、`ko` ×0（完全关闭）。

### 根部移动辅助

- `setRootVelocity(vx, vy)`：PD 控制器持续把髋部速度推向目标值——**推荐移动方式**，稳定且与腿部动画解耦（配合腿部摆动即可看起来像走路）。
- `applyRootForce(fx, fy)`：对髋部施加一次性冲量，**仅当帧有效**（每帧物理步后清零），适合起身蹬腿这类瞬间发力。
- 两者只在 `normal` 状态生效；`stun` / `down` / `ko` 期间被压制。
- **起跳**：给 `setRootVelocity` 的 `vy` 一个正值即可（如 430）。悬停弹簧会识别这个指令并让开，髋部升到静息高度以上后不再回拽，跳跃是正常抛物线。


## 沙箱限制与错误行为

| 限制 | 行为 |
| --- | --- |
| 单帧 SDK 指令 ≤ 500 条 | 超出直接抛错（计入运行时错误） |
| `log` 每帧 ≤ 8 条 | 超出的静默丢弃；`logWarn` 不限 |
| onTick 600ms 看门狗 | tick 回调超时（死循环）→ 该角色逻辑被终止，控制台提示「死循环已终止」，修改代码后重新「▶ 运行」 |
| 连续 5 次运行时错误 | 暂停该角色逻辑（`onTick` 成功一次即清零计数）；点「↺ 重置回合」恢复 |
| 读状态 API 的时机 | 依赖最近一帧快照；第一次 `onTick` 之前（如 `onInit` 中）调用会抛「游戏尚未开始」 |
| 非法参数 | 部件名不存在、参数不是有限数字等都会抛错，错误信息里会列出可用名称 |
