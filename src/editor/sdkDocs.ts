import { ALL_PARTS } from '../skeleton/partDefs'

/** SDK 文档（应用内「SDK 文档」标签页），与 docs/SDK.md 内容保持一致 */
export const SDK_DOCS_HTML = `
<h2>Joint Arena SDK 文档</h2>
<p>玩家代码运行在 <b>Web Worker 沙箱</b>中，与游戏主线程通过消息通信。
代码里唯一可用的入口是全局对象 <code class="mono">sdk</code>。
没有 DOM / window / document；死循环不会卡死游戏，但该角色逻辑会被自动终止。</p>

<h3>快速上手</h3>
<pre>sdk.onInit(() => {
  sdk.log('初始化，只执行一次');
  sdk.setPartColor(sdk.P.TORSO, '#4f8cff');   // 染个色
});

sdk.onTick((dt) => {                       // 每物理帧调用（60Hz）
  sdk.setJointMotor(sdk.P.UPPERARM_R, 60, 300); // 抬右臂
});

sdk.bindKey('j', () => {                   // 按键绑定（事件驱动）
  sdk.setJointMotor(sdk.P.FOREARM_R, 5, 900); // 伸肘 = 出拳
});</pre>

<h3>统一部件 key（sdk.P）</h3>
<p>行动（关节驱动）、外观（颜色 / 贴图）、传感器（坐标 / 接触 / 射线）共用<b>同一套部件 key</b>，
推荐用枚举 <code class="mono">sdk.P.*</code>，不要手写字符串：</p>
<pre>sdk.P.HIP · sdk.P.TORSO · sdk.P.HEAD
sdk.P.UPPERARM_R · sdk.P.FOREARM_R · sdk.P.HAND_R      // 左侧同名 _L
sdk.P.THIGH_R · sdk.P.SHIN_R · sdk.P.FOOT_R</pre>
<p class="muted small">枚举值 = 部件名（如 <code class="mono">sdk.P.FOREARM_R</code> 即 <code class="mono">'forearm_R'</code>）。
<b>动作作用于该部件绕父部件的旋转</b>：P.FOREARM_R = 弯肘、P.SHIN_R = 弯膝、P.TORSO = 弯腰、P.HEAD = 转头；
P.HIP 是根部件，没有驱动关节（移动用 setRootVelocity）。</p>

<h3>坐标与角度约定</h3>
<ul>
  <li>世界坐标：x 向右，<b>y 向上</b>，地面 y=0，单位 = 像素。</li>
  <li>关节角：<b>0° = 静止姿态</b>（双臂自然下垂站立）。正方向以角色朝向为准：肩/髋向前抬为正，肘/膝弯曲为正。</li>
  <li>部件朝向：部件轴从「轴心」指向「末端」。静止站立时全身部件轴均朝下（-90°）；
  头的轴心在头顶、脚的轴心在脚踝。</li>
</ul>

<h3>生命周期</h3>
<table>
  <tr><th>API</th><th>说明</th></tr>
  <tr><td class="mono">onInit(cb)</td><td>代码加载完成后调用一次</td></tr>
  <tr><td class="mono">onTick(cb(dt))</td><td>每物理帧调用，dt 为帧间隔（秒）</td></tr>
  <tr><td class="mono">onEvent(cb(e))</td><td>事件回调：roundStart / roundEnd / hit / dealHit / stateChange / keydown / keyup / mousedown / mouseup</td></tr>
  <tr><td class="mono">onDestroy(cb)</td><td>代码被停止时调用</td></tr>
</table>

<h3>关节控制（14 个关节，统一部件 key）</h3>
<p class="mono small">sdk.P.TORSO · sdk.P.HEAD · sdk.P.UPPERARM_R/L · sdk.P.FOREARM_R/L · sdk.P.HAND_R/L · sdk.P.THIGH_R/L · sdk.P.SHIN_R/L · sdk.P.FOOT_R/L</p>
<table>
  <tr><th>API</th><th>说明</th></tr>
  <tr><td class="mono">setJointMotor(part, targetAngle, speed=360, maxTorque?)</td><td>伺服马达：以限速 speed（度/秒）把 part 转向目标角，maxTorque 限制力量</td></tr>
  <tr><td class="mono">setJointAngle(part, angle)</td><td>刚性设角（高刚度伺服）</td></tr>
  <tr><td class="mono">rotateJoint(part, deltaAngle)</td><td>从当前角旋转相对量</td></tr>
  <tr><td class="mono">getJointAngle(part)</td><td>读当前角度（度）</td></tr>
  <tr><td class="mono">setJointTorque(part, torque)</td><td>直接施加扭矩（仅当帧有效）</td></tr>
  <tr><td class="mono">setJointLimits(part, min, max)</td><td>收窄角度限位（不能超出解剖硬限位）</td></tr>
</table>
<p class="muted small">提示：每帧重复调用 setJointMotor 是推荐用法（PD 伺服需要持续指令）。
setJointTorque 只持续一帧，需要每帧调用。</p>

<h3>骨骼与传感器</h3>
<table>
  <tr><th>API</th><th>说明</th></tr>
  <tr><td class="mono">getBonePosition(part)</td><td>部件轴心世界坐标 {x, y}</td></tr>
  <tr><td class="mono">getBoneVelocity(part)</td><td>部件速度 {x, y}（px/s）</td></tr>
  <tr><td class="mono">getBoneRotation(part)</td><td>部件轴角度（度）</td></tr>
  <tr><td class="mono">getOpponentBonePosition(part)</td><td>对手部件坐标</td></tr>
  <tr><td class="mono">getDistanceTo(part | 'opp:head')</td><td>自己躯干到目标部件的距离</td></tr>
  <tr><td class="mono">getContacts(part)</td><td>接触列表：'ground' / 'wall_L' / 'P2:head' …</td></tr>
  <tr><td class="mono">raycast(origin, direction, distance)</td><td>射线检测（对双方部件胶囊 + 地面/墙）。返回 {hit, distance, point, part}</td></tr>
</table>
<p class="mono small">部件 key：${ALL_PARTS.map(p => `sdk.P.${p.toUpperCase()}`).join(' · ')}</p>

<h3>输入</h3>
<table>
  <tr><th>API</th><th>说明</th></tr>
  <tr><td class="mono">bindKey(key, cb)</td><td>按键按下回调（key 小写，如 'a' / 'arrowleft' / ' '）</td></tr>
  <tr><td class="mono">bindMouse(button, cb)</td><td>鼠标按下回调（'left'|'middle'|'right'）</td></tr>
  <tr><td class="mono">isKeyDown(key) / isMouseDown(button)</td><td>状态查询（onTick 中轮询）</td></tr>
  <tr><td class="mono">getMousePosition()</td><td>鼠标世界坐标</td></tr>
</table>
<p class="muted small">按键事件只在焦点不在代码编辑器内时转发（避免打字误触）；点「运行 / 重置回合」会自动把焦点还给游戏，之后按键立即生效。</p>

<h3>纹理与外观</h3>
<table>
  <tr><th>API</th><th>说明</th></tr>
  <tr><td class="mono">setPartColor(part, '#4f8cff' | 0x4f8cff)</td><td>染色（乘法 tint）</td></tr>
  <tr><td class="mono">setPartTexture(part, url)</td><td>图片贴图（PNG/JPG/WebP，≤512×512，跨域需 CORS）</td></tr>
  <tr><td class="mono">createCanvas(w, h)</td><td>创建 OffscreenCanvas（沙箱内无 DOM）</td></tr>
  <tr><td class="mono">setPartTextureFromCanvas(part, canvas)</td><td>Canvas 贴图（建议部件尺寸×4）</td></tr>
  <tr><td class="mono">setPartScale(part, sx, sy) / setPartOffset(part, ox, oy)</td><td>缩放 / 偏移（ox 沿部件轴，oy 朝面朝方向）</td></tr>
  <tr><td class="mono">resetPart(part)</td><td>恢复默认白膜</td></tr>
</table>
<p class="muted small">贴图画布规格：宽 = 部件宽×4，高 = 部件长×4，锚点在顶边中点。
内容竖直绘制（向下延伸），渲染时随部件旋转；画布 +x 侧对应角色面朝方向。</p>

<h3>工具与扩展</h3>
<table>
  <tr><th>API</th><th>说明</th></tr>
  <tr><td class="mono">log(obj) / logWarn(obj)</td><td>输出到控制台（每帧限 8 条）；console.log / warn / error 也会路由到这里</td></tr>
  <tr><td class="mono">getTime() / getDeltaTime()</td><td>累计时间 / 帧间隔</td></tr>
  <tr><td class="mono">getHp() / getOpponentHp() / getSelfState() / getOpponentState()</td><td>血量与状态（normal/stun/down/ko）</td></tr>
  <tr><td class="mono">setBalanceStrength(0 ~ 1.6)</td><td>平衡辅助强度（游戏内建姿态维持系统，0 = 纯物理）；站立时它已经帮你站稳，不必自己写站姿</td></tr>
  <tr><td class="mono">setRootVelocity(vx, vy) / stopMoving()</td><td>根部移动辅助（推荐移动方式）；给 vy 正值即起跳（如 <span class="mono">(0, 430)</span>）</td></tr>
  <tr><td class="mono">applyRootForce(fx, fy)</td><td>对髋部直接施力（仅当帧）</td></tr>
  <tr><td class="mono">getRoundTime()</td><td>回合剩余时间</td></tr>
  <tr><td class="mono">sdk.P</td><td>统一部件枚举（行动 / 外观 / 传感器共用）；sdk.PARTS 为部件名数组</td></tr>
</table>

<h3>怎么让它像人一样走路</h3>
<p>站稳由平衡辅助负责，你只需要把两件事对上：<b>位移</b> 与 <b>腿部摆动节奏</b>。</p>
<pre>let phase = 0;

sdk.onTick((dt) =&gt; {
  const dir = (sdk.isKeyDown('d') ? 1 : 0) - (sdk.isKeyDown('a') ? 1 : 0);
  const walking = dir !== 0;
  if (walking) phase += dt * 9;              // 摆得越快走得越快

  const s = walking ? Math.sin(phase) : 0;
  const c = walking ? Math.cos(phase) : 0;
  sdk.setJointMotor(sdk.P.THIGH_R, 6 + s * 24, 300);              // 前摆
  sdk.setJointMotor(sdk.P.SHIN_R, 10 + Math.max(0, c) * 34, 340); // 前摆时屈膝抬脚
  sdk.setJointMotor(sdk.P.THIGH_L, 6 - s * 24, 300);              // 左腿反相
  sdk.setJointMotor(sdk.P.SHIN_L, 10 + Math.max(0, -c) * 34, 340);

  sdk.setRootVelocity(dir * 220, 0);         // 位移交给根部移动辅助
});</pre>
<p class="muted small">要点：摆动频率（<span class="mono">dt * 9</span>）与位移速度（<span class="mono">220</span>）要匹配，
否则脚会在地上打滑；前摆的同时屈膝抬脚，才不会像在滑冰。起跳用
<span class="mono">sdk.setRootVelocity(0, 430)</span>，悬停弹簧会自动让开。</p>

<h3>限制</h3>
<ul>
  <li>单帧 SDK 指令 ≤ 500 条，日志每帧 ≤ 8 条，超出会报错/丢弃。</li>
  <li>tick 回调若 600ms 无响应（死循环），该角色逻辑被终止并提示错误。</li>
  <li>连续 5 次运行时错误后暂停该角色逻辑；点「重置回合」恢复。</li>
</ul>
`
