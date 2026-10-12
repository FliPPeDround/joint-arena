# 纹理自定义指南

角色的每个部件都是一张可以替换的贴图。共有三种自定义方式，全部通过 SDK 代码调用（可写在 `onInit` 里，也可以运行中随时改）：

| 方式 | API | 适用场景 |
| --- | --- | --- |
| 染色 | `sdk.setPartColor(part, '#4f8cff' \| 0x4f8cff)` | 最简单。乘法 tint（与原贴图颜色相乘），白膜是接近白色的浅灰，所以染什么色就是什么色 |
| 图片贴图 | `sdk.setPartTexture(part, url)` | 用现成图片文件 |
| Canvas 绘制 | `sdk.createCanvas(w, h)` + `sdk.setPartTextureFromCanvas(part, canvas)` | 程序化画脸、画花纹，最灵活 |

三种方式可以混用（后设置的覆盖先设置的）；`sdk.resetPart(part)` 恢复默认白膜。

## 三种方式的限制

**setPartColor(part, color)**

- 接受 `'#4f8cff'` 或 `0x4f8cff`；颜色非法会抛错。
- 是乘法 tint：无法把深色染亮（所以建议整张贴图用浅色打底）。

**setPartTexture(part, url)**

- 格式 PNG / JPG / WebP；**拒绝 SVG**（按 content-type 和扩展名双重判断）。
- 尺寸上限 **1024×1024**（超大会报「贴图过大」）。
- 图片由游戏用 `fetch` 加载：**跨域图片需要服务器返回 CORS 头**，否则加载失败（错误会打印到控制台，不影响角色逻辑运行）。

**setPartTextureFromCanvas(part, canvas)**

- canvas 必须是 `sdk.createCanvas(w, h)` 创建的 **OffscreenCanvas**（沙箱里没有 DOM，不能用 `document.createElement('canvas')`）。
- 画布 `w×h ≤ 1024×1024`，w/h 必须为正。

## 模板规格（重要）

自定义贴图（图片或 Canvas）请按以下规格绘制，否则显示会错位或变形：

- **画布宽 = 部件宽 W × 4，画布高 = 部件长 L × 4**（`TEMPLATE_SCALE = 4`，4 倍分辨率便于画细节）。
- **锚点 = 顶边中点**：渲染时画布顶边中点对齐部件轴心，内容**竖直向下延伸**（沿部件轴，从轴心端画到末端），渲染时随部件一起旋转。
- **画布 +x 侧 = 面朝方向**（P1 朝 +x）。P2 的镜像由引擎整体处理，你只需要画一份。
- 引擎按「贴图像素 ÷ 4」确定显示大小，所以严格用 4× 模板尺寸才能 1:1 对上部件。

以头部（`head`，宽 20 × 长 22）为例，模板画布 80×88：

```
          锚点 = 顶边中点 (40, 0)
                 ▼
   ┌───────────────────────────┐ ── 画布顶边 = 部件轴心端
   │         头发              │     （head 的轴心在头顶）
   │      眼睛    鼻子 ▸       │
   │         嘴                │     内容竖直向下延伸
   └───────────────────────────┘ ── 画布底边 = 部件末端（颈部）
        +x →（右侧 = 面朝方向）
```

四肢同理：上臂模板画布 32×112，顶边 = 肩端，底边 = 肘端；躯干 96×144，顶边 = 颈，底边 = 髋。

## 部件尺寸表

注意这里给的是 **宽 W × 长 L**（与骨架文档的 L×W 相反），因为画布是「宽 = W×4、高 = L×4」：

| 部件 | 宽 W × 长 L (px) | 模板画布 (×4) | 锚点（画布内） |
| --- | --- | --- | --- |
| `hip` | 22×16 | 88×64 | (44, 0) |
| `torso` | 24×36 | 96×144 | (48, 0) |
| `head` | 20×22 | 80×88 | (40, 0) |
| `upperarm_R` / `upperarm_L` | 8×28 | 32×112 | (16, 0) |
| `forearm_R` / `forearm_L` | 7×26 | 28×104 | (14, 0) |
| `hand_R` / `hand_L` | 8×10 | 32×40 | (16, 0) |
| `thigh_R` / `thigh_L` | 10×36 | 40×144 | (20, 0) |
| `shin_R` / `shin_L` | 8×34 | 32×136 | (16, 0) |
| `foot_R` / `foot_L` | 12×18 | 48×72 | (24, 0) |

脚的轴心在踝、轴指向脚尖：脚模板画布顶边 = 踝端，底边 = 脚尖。

## 完整示例：用 Canvas 换个头

粘到 P1 或 P2 的代码里运行（可叠加在任意示例之上）：

```js
sdk.onInit(() => {
  // head 部件：宽 20 × 长 22 → 模板画布 80×88，锚点 = 顶边中点 (40, 0)
  const cv = sdk.createCanvas(80, 88);
  const g = cv.getContext('2d');

  // 脸底色：圆角矩形铺满整张画布
  g.fillStyle = '#ffd9a8';
  g.beginPath();
  g.roundRect(0, 0, 80, 88, 14);
  g.fill();

  // 头发：画布顶边 = 头顶
  g.fillStyle = '#3b2f2a';
  g.beginPath();
  g.roundRect(0, 0, 80, 26, { tl: 14, tr: 14, bl: 4, br: 4 });
  g.fill();

  // 眼睛：画布 +x 侧 = 面朝方向，双眼整体向 +x 偏一点显得在“看”对手
  g.fillStyle = '#26303f';
  g.beginPath(); g.arc(34, 44, 6, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(62, 44, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(32, 42, 2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(60, 42, 2, 0, Math.PI * 2); g.fill();

  // 鼻子：贴着面朝一侧（+x 边缘）
  g.fillStyle = '#e0a878';
  g.fillRect(72, 50, 5, 3);

  // 嘴
  g.strokeStyle = '#a4552f';
  g.lineWidth = 3;
  g.beginPath(); g.arc(48, 62, 9, 0.2, Math.PI - 0.2); g.stroke();

  // 应用到头部
  sdk.setPartTextureFromCanvas('head', cv);

  // 顺手染个色、放大个拳头
  sdk.setPartColor('torso', '#4f8cff');
  sdk.setPartScale('hand_R', 1.2, 1.2);
});

sdk.onTick((dt) => {
  // 换肤不影响动作：给个最简站立
  sdk.setJointMotor('knee_R', 5, 240);
  sdk.setJointMotor('knee_L', 5, 240);
  sdk.setJointMotor('hip_R', -5, 200);
  sdk.setJointMotor('hip_L', -5, 200);
});
```

示例「06 换肤 · 颜色与 Canvas」（编辑器下拉里可加载）演示了同样的技术并染了全身。

## 应用内「纹理」标签页

右侧面板的「纹理」标签页是纹理工作的速查与预览工具：

- **预览画布**：显示当前选中部件的白膜贴图，叠加红色十字标注锚点位置（顶边中点），底部提示「贴图向下延伸」；下方一行文字给出精确规格，如 `head 画布 80×88px（逻辑 20×22，×4），锚点=顶边中点 (40,0)`。
- **部件列表**：每个部件一行——部件名、尺寸（宽×高）、色板（`<input type="color">`）、重置按钮。**点击行**选中该部件（预览与模板下载随之切换）。
- **色板**：拖动颜色实时染色预览。注意色板预览会同时应用到 P1 和 P2 两边（方便看效果）；而 SDK 代码里的 `setPartColor` 只影响写代码的那一方。
- **⬇ 下载当前部件模板 PNG**：导出一张与模板规格完全一致的透明底 PNG（虚线边框 + 红色锚点十字 + 部件名与尺寸标注，文件名 `template_<部件名>.png`），可直接导入绘图软件（Photoshop / Aseprite / Procreate 等）按底稿作画。
- **重置按钮**：把该部件恢复为默认白膜（等价 `sdk.resetPart`，同样作用于双方预览）。

## 小贴士

- 想做全身皮肤：按尺寸表批量画 15 张 4× 贴图，在 `onInit` 里依次 `setPartTextureFromCanvas`，一次运行全部生效。
- 贴图/染色/缩放/偏移会一直保留到「重置回合」（回合重置会恢复白膜）或调用 `resetPart`。
- `setPartOffset(part, ox, oy)` 可以把贴图沿轴（ox，正 = 向末端）或朝面朝侧（oy，正 = 面朝方向）挪动，给「护肩」「手套」这类覆盖物留位。
- 部件尺寸与 z 层级的权威定义在 `src/skeleton/partDefs.ts`，骨架结构见 [SKELETON.md](SKELETON.md)。
