# 十分钟上手

目标：从打开页面开始，写出一个**会向对手移动、并在贴近时自动出拳**的角色。只需要会基础 JavaScript。

## 第 0 步：跑起来（1 分钟）

```bash
npm install
npm run dev
```

打开 http://127.0.0.1:5173。界面分两块：

- **左侧**：格斗场地。两个白膜人站在场地上，顶部是血条与回合计时。
- **右侧**：编辑面板。顶部有 P1 / P2 页签（各一份代码）、示例下拉、三个按钮（`▶ 运行` / `■ 停止` / `↺ 重置回合`）；下方是控制台。

## 第 1 步：先打一局（2 分钟）

两侧默认已加载「07 完整格斗 AI」。先点击右侧的 **`▶ 运行`**，再点一下左侧游戏画面（让它获得键盘焦点），然后：

| 按键 | 动作 |
| --- | --- |
| A / D | 左 / 右移动 |
| J | 出拳 |
| K | 踢腿 |
| S（按住） | 格挡 |

看完感觉后点 `■ 停止`。现在开始写你自己的代码。

## 第 2 步：理解三个核心概念

**1. 关节马达**。角色的每个关节由伺服马达驱动，统一用**部件 key**（`sdk.P.*` 枚举）指定要动的部位：

```js
sdk.setJointMotor(sdk.P.FOREARM_R, 90, 300); // 右前臂（弯肘）以 300 度/秒 的限速弯到 90 度
```

它是「以限速逼近目标角」的伺服，**必须在 onTick 里每帧重复调用**——只调一次，下一帧就被别的逻辑覆盖了。

**2. 根部移动**。走路不靠模拟迈步，用移动辅助直接驱动髋部：

```js
sdk.setRootVelocity(200, 0);  // 髋部以 200px/s 水平移动（正 = 向右）
sdk.stopMoving();             // 停下
```

腿只负责「摆动」——摆动节奏和位移对上，看起来就是走路（见第 4 步）。想跳就给 `vy` 一个正值（如 `sdk.setRootVelocity(0, 430)`），悬停弹簧会自动让开。

**3. 沙箱**。你的代码运行在 Web Worker 里，唯一的全局对象是 `sdk`，没有 DOM。`sdk.onTick(cb)` 每物理帧（60Hz）调用一次；**读游戏状态的 API 只能在 onTick（或按键/事件回调）里用**，在 `onInit` 里调用会报错（第一帧快照还没生成）。死循环不会卡死游戏，但 600ms 无响应后你的角色逻辑会被终止。

## 第 3 步：坐标与角度约定（重要，30 秒背下来）

- **世界坐标**：x 向右，**y 向上**，地面 y=0，单位是像素。重力 -2200 px/s²。
- **关节角**：**0° = 静止姿态**（双臂自然下垂的直立站姿）。正方向以**角色自己的朝向**为准：
  - 肩、髋：**向前抬为正**（`P.UPPERARM_R` 90° ≈ 手臂前平举）；
  - 肘、膝：**弯曲为正**（0° = 伸直，最大 150°）；
  - 脊柱、颈：正 = 后仰 / 抬头，负 = 前躬 / 低头；
  - 踝：正 = 勾脚尖，负 = 绷脚尖。
- P1 出生在左侧面朝右，P2 在右侧面朝左——同一句 `setJointMotor(sdk.P.UPPERARM_R, 90, …)` 对两边都是「向前抬」，不用你做镜像。

部件 key 速记：`P.TORSO` `P.HEAD`（弯腰 / 转头）；`P.UPPERARM_R/L` `P.FOREARM_R/L` `P.HAND_R/L`（肩 / 肘 / 腕）；`P.THIGH_R/L` `P.SHIN_R/L` `P.FOOT_R/L`（髋 / 膝 / 踝）。完整限位表见 [SDK.md](SDK.md)。

## 第 4 步：完整示例——追着对手出拳

把下面的代码粘到 **P1 的编辑器**（想测试对打就两边都粘），点 `▶ 运行`：

```js
// ===== 我的第一具格斗骨架：向对手移动 + 贴近自动出拳 =====

// 跨帧变量直接写在文件顶层
let atkTimer = 0;     // 本轮出拳剩余时间（秒）
let punched = false;  // 本轮是否已经打出去
let phase = 0;        // 步态相位

sdk.onInit(() => {
  sdk.log('我的第一个格斗 AI 已加载');   // 输出在右侧控制台
});

// J 键也能手动触发一轮出拳（事件驱动）
sdk.bindKey('j', () => {
  if (atkTimer <= 0) { atkTimer = 0.34; punched = false; }
});

sdk.onTick((dt) => {
  // ---- 1. 基础战斗姿态：双臂抬在胸前（每帧都要发）----
  sdk.setJointMotor(sdk.P.UPPERARM_R, 55, 300);
  sdk.setJointMotor(sdk.P.FOREARM_R, 95, 300);
  sdk.setJointMotor(sdk.P.UPPERARM_L, 55, 300);
  sdk.setJointMotor(sdk.P.FOREARM_L, 95, 300);

  // ---- 2. 出拳状态机：拉回 → 打出 → 收拳 ----
  if (atkTimer > 0) {
    atkTimer -= dt;
    const t = 1 - atkTimer / 0.34;                            // 出拳进度 0 → 1
    if (t < 0.4) {
      sdk.setJointMotor(sdk.P.FOREARM_R, 130, 500);           // 先把肘弯到最大（拉回）
    } else if (!punched) {
      sdk.setJointMotor(sdk.P.UPPERARM_R, 95, 900);           // 肩快速前送
      sdk.setJointMotor(sdk.P.FOREARM_R, 5, 1100, 4000);      // 肘高速伸直 = 打出去
      punched = true;
    } else {
      sdk.setJointMotor(sdk.P.UPPERARM_R, 55, 500);           // 收拳回备战姿态
      sdk.setJointMotor(sdk.P.FOREARM_R, 95, 500);
    }
  }

  // ---- 3. 追踪对手：读双方躯干坐标，决定移动 ----
  const opp = sdk.getOpponentBonePosition(sdk.P.TORSO);
  const me  = sdk.getBonePosition(sdk.P.TORSO);
  const d = opp.x - me.x;
  const walking = Math.abs(d) > 70;

  // ---- 4. 迈步：位移交给 setRootVelocity，腿只负责摆动 ----
  // 关键在于「摆动节奏与位移对上」：摆得越快走得越快，脚才会像踩在地上。
  const s = walking ? Math.sin(phase) : 0;
  const c = walking ? Math.cos(phase) : 0;
  if (walking) phase += dt * 9;
  sdk.setJointMotor(sdk.P.THIGH_R, 6 + s * 24, 300);          // 右腿前摆
  sdk.setJointMotor(sdk.P.SHIN_R, 10 + Math.max(0, c) * 34, 340); // 前摆时屈膝抬脚
  sdk.setJointMotor(sdk.P.THIGH_L, 6 - s * 24, 300);          // 左腿反相
  sdk.setJointMotor(sdk.P.SHIN_L, 10 + Math.max(0, -c) * 34, 340);

  if (walking) {
    sdk.setRootVelocity(Math.sign(d) * 220, 0);               // 朝对手走
  } else {
    sdk.stopMoving();                                        // 进入拳程：站定出拳
    if (atkTimer <= 0) { atkTimer = 0.34; punched = false; }
  }
});
```

跑起来后你会看到角色迈步逼近对手，进圈后不停打出右直拳。控制台里 `sdk.log` 的内容、命中与报错都会显示出来。

**这段代码用到的 API：**

| API | 作用 |
| --- | --- |
| `onInit(cb)` | 代码加载完成后调用一次（只做初始化，别在这里读状态） |
| `onTick(cb(dt))` | 每物理帧调用，`dt` 是帧间隔（秒） |
| `bindKey(key, cb)` | 按键按下回调，key 用小写（`'j'`、`'arrowleft'`、空格是 `' '`） |
| `setJointMotor(part, target, speed, maxTorque?)` | 关节伺服（part 用 `sdk.P.*` 部件 key）；`speed` 单位度/秒（最小 30），`maxTorque` 限制力量（出拳时调大） |
| `setRootVelocity(vx, vy)` / `stopMoving()` | 髋部速度控制（推荐移动方式） |
| `getBonePosition(part)` / `getOpponentBonePosition(part)` | 自己 / 对手某部件轴心的世界坐标 `{x, y}` |

## 第 5 步：接下来玩什么

- 加载示例 **04 踢腿 · 连段**，对比它踢腿的关节序列（提膝 → 弹踢 → 收腿）；
- 加载 **05 防御 · 格挡**：双前臂竖直上抬且手腕高于髋部时，受到的伤害降到 35%；
- 加载 **06 换肤**：用 `sdk.createCanvas` 画一张脸贴到头上（见 [TEXTURE_TEMPLATE.md](TEXTURE_TEMPLATE.md)）；
- 完整 API 见 [SDK.md](SDK.md)，骨架结构见 [SKELETON.md](SKELETON.md)。

## 常见坑

| 现象 | 原因 |
| --- | --- |
| 关节只动一下就回去了 | `setJointMotor` 必须在 `onTick` 里每帧调用 |
| 控制台报「游戏尚未开始」 | 在 `onInit` 里调用了读状态的 API（`getBonePosition` 等），挪到 `onTick` |
| 控制台报「单帧 SDK 指令超过上限」 | 一帧里调了超过 500 条 SDK 指令，减少每帧调用 |
| 角色逻辑突然「死循环已终止」 | 某次 onTick 超过 600ms 没返回（如 while 死循环），修改代码后重新 `▶ 运行` |
| 日志刷不出来 | `sdk.log` 每帧限 8 条，超出的被丢弃（`sdk.logWarn` 不限） |
| 连续报错后角色不动了 | 连续 5 次运行时错误会暂停该角色逻辑，点 `↺ 重置回合` 恢复 |
