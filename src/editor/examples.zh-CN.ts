import type { ExampleId } from './examples'

/** 示例代码（zh-CN）：与 examples.en-US.ts 逐份对应，逻辑必须完全一致，只翻注释与 sdk.log 文案 */
export const EXAMPLE_CODES: Record<ExampleId, string> = {
  '01_standing': `// 站立示例：什么都不用写，游戏内建的平衡辅助就会让角色站稳。
// 关节角 0° = 静止站姿；正方向 = 朝自己的面朝方向。
// 想让角色动，就在 onTick 里每帧给对应部件发一个目标角。

sdk.onTick(() => {
  // 双手自然下垂、微微含肘，看起来像个活人
  sdk.setJointMotor(sdk.P.UPPERARM_R, 6, 120);
  sdk.setJointMotor(sdk.P.UPPERARM_L, 6, 120);
  sdk.setJointMotor(sdk.P.FOREARM_R, 14, 120);
  sdk.setJointMotor(sdk.P.FOREARM_L, 14, 120);
});`,
  '02_walk': `// 移动示例：A / D 左右移动，W 起跳。
// 平衡辅助已经负责站稳，位移用 setRootVelocity 驱动髋部，
// 双腿只负责摆动——摆动节奏对上了，看起来就是走路。

let phase = 0;      // 步态相位
let jumpTime = 0;   // 起跳助推剩余时间

sdk.onTick((dt) => {
  const dir = (sdk.isKeyDown('d') ? 1 : 0) - (sdk.isKeyDown('a') ? 1 : 0);
  const walking = dir !== 0;
  if (walking) phase += dt * 9;

  // 步态：双腿反相摆动。前摆的那条腿同时屈膝抬脚，才像迈步而不是滑步。
  const s = walking ? Math.sin(phase) : 0;
  const c = walking ? Math.cos(phase) : 0;
  sdk.setJointMotor(sdk.P.THIGH_R, 6 + s * 24, 300);
  sdk.setJointMotor(sdk.P.SHIN_R, 10 + Math.max(0, c) * 34, 340);
  sdk.setJointMotor(sdk.P.FOOT_R, -s * 8, 260);
  sdk.setJointMotor(sdk.P.THIGH_L, 6 - s * 24, 300);
  sdk.setJointMotor(sdk.P.SHIN_L, 10 + Math.max(0, -c) * 34, 340);
  sdk.setJointMotor(sdk.P.FOOT_L, s * 8, 260);

  // 手臂与腿反相摆动
  sdk.setJointMotor(sdk.P.UPPERARM_R, 6 - s * 18, 220);
  sdk.setJointMotor(sdk.P.UPPERARM_L, 6 + s * 18, 220);
  sdk.setJointMotor(sdk.P.FOREARM_R, 16, 220);
  sdk.setJointMotor(sdk.P.FOREARM_L, 16, 220);

  // 起跳：双脚有一只踩在地上才能起跳，助推持续一小段时间
  const grounded = sdk.getContacts(sdk.P.FOOT_R).includes('ground')
    || sdk.getContacts(sdk.P.FOOT_L).includes('ground');
  if (sdk.isKeyDown('w') && grounded && jumpTime <= 0) jumpTime = 0.28;
  jumpTime -= dt;
  sdk.setRootVelocity(dir * 220, jumpTime > 0 ? 430 : 0);
});`,
  '03_punch': `// 出拳示例：按 J 打出右直拳。一轮出拳分三段——拉回、打出、收拳。

let atk = 0;        // 本轮出拳剩余时间（秒）
let fired = false;  // 这一轮是否已经打出去

sdk.bindKey('j', () => {
  if (atk <= 0) { atk = 0.34; fired = false; }
});

sdk.onEvent((e) => {
  if (e.type === 'hit') sdk.log('被打了一下 -' + e.damage);
  if (e.type === 'dealHit') sdk.log('命中对方 -' + e.damage);
});

sdk.onTick((dt) => {
  // 备战姿态：双拳抬在胸前（每帧都要发，否则会被别的逻辑覆盖）
  sdk.setJointMotor(sdk.P.UPPERARM_R, 55, 300);
  sdk.setJointMotor(sdk.P.FOREARM_R, 95, 300);
  sdk.setJointMotor(sdk.P.UPPERARM_L, 55, 300);
  sdk.setJointMotor(sdk.P.FOREARM_L, 95, 300);

  if (atk > 0) {
    atk -= dt;
    if (1 - atk / 0.34 < 0.4) {
      sdk.setJointMotor(sdk.P.FOREARM_R, 130, 500);        // 拉回，蓄力
    } else if (!fired) {
      sdk.setJointMotor(sdk.P.UPPERARM_R, 95, 900);        // 肩前送
      sdk.setJointMotor(sdk.P.FOREARM_R, 5, 1100, 4000);   // 肘弹直 = 打出去
      fired = true;
    } else {
      sdk.setJointMotor(sdk.P.UPPERARM_R, 55, 500);        // 收拳
      sdk.setJointMotor(sdk.P.FOREARM_R, 95, 500);
    }
  }

  // 出拳时朝对手方向压上，其余时候站定
  const d = sdk.getOpponentBonePosition(sdk.P.TORSO).x - sdk.getBonePosition(sdk.P.TORSO).x;
  sdk.setRootVelocity(atk > 0 && Math.abs(d) > 60 ? Math.sign(d) * 150 : 0, 0);
});`,
  '04_kick': `// 踢腿示例：按 K 踢右腿（提膝 → 弹踢 → 收腿）。左腿全程当支撑腿。

let atk = 0;
let fired = false;

sdk.bindKey('k', () => {
  if (atk <= 0) { atk = 0.5; fired = false; }
});

sdk.onTick((dt) => {
  // 支撑腿 + 上身：左手抬起护头，右手放低保持平衡
  sdk.setJointMotor(sdk.P.THIGH_L, 4, 260);
  sdk.setJointMotor(sdk.P.SHIN_L, 8, 280);
  sdk.setJointMotor(sdk.P.UPPERARM_L, 60, 260);
  sdk.setJointMotor(sdk.P.FOREARM_L, 80, 260);
  sdk.setJointMotor(sdk.P.UPPERARM_R, -10, 260);
  sdk.setJointMotor(sdk.P.FOREARM_R, 30, 260);

  // 右腿默认垂放
  sdk.setJointMotor(sdk.P.THIGH_R, 4, 260);
  sdk.setJointMotor(sdk.P.SHIN_R, 8, 280);
  sdk.setJointMotor(sdk.P.FOOT_R, 0, 220);
  if (atk <= 0) return;

  atk -= dt;
  if (1 - atk / 0.5 < 0.35) {
    sdk.setJointMotor(sdk.P.THIGH_R, 85, 520);            // 提膝
    sdk.setJointMotor(sdk.P.SHIN_R, 100, 520);
  } else if (!fired) {
    sdk.setJointMotor(sdk.P.SHIN_R, 2, 1100, 6000);       // 弹踢：小腿甩出去
    sdk.setJointMotor(sdk.P.FOOT_R, 20, 400);
    fired = true;
  } else {
    sdk.setJointMotor(sdk.P.THIGH_R, 30, 420);            // 收腿
    sdk.setJointMotor(sdk.P.SHIN_R, 55, 420);
  }
});`,
  '05_guard': `// 防御示例：按住 S 抬起双臂格挡。
// 格挡判定：双前臂接近竖直向上、且手腕高于髋部 → 受到的伤害降到 35%。

sdk.onTick(() => {
  const guard = sdk.isKeyDown('s');

  // 格挡时抬臂夹肘护住面门，平时双手放低
  sdk.setJointMotor(sdk.P.UPPERARM_R, guard ? 80 : 30, 400);
  sdk.setJointMotor(sdk.P.FOREARM_R, guard ? 65 : 70, 400);
  sdk.setJointMotor(sdk.P.UPPERARM_L, guard ? 80 : 30, 400);
  sdk.setJointMotor(sdk.P.FOREARM_L, guard ? 65 : 70, 400);

  // 格挡时把平衡辅助调高一点，扛得住冲击
  sdk.setBalanceStrength(guard ? 1.2 : 1);
  if (guard) sdk.stopMoving();
});`,
  '06_texture': `// 换肤示例：染色 + 用 OffscreenCanvas 给头部画脸。
// 部件 key 与行动统一：sdk.P.*（尺寸规格见「纹理」标签页）。

sdk.onInit(() => {
  sdk.log('换肤示例已加载');

  // 1) 纯色染色
  sdk.setPartColor(sdk.P.TORSO, '#4f8cff');
  sdk.setPartColor(sdk.P.HIP, '#3c6fd9');
  sdk.setPartColor(sdk.P.UPPERARM_R, '#4f8cff');
  sdk.setPartColor(sdk.P.UPPERARM_L, '#4f8cff');
  sdk.setPartColor(sdk.P.FOREARM_R, '#e8ecf5');
  sdk.setPartColor(sdk.P.FOREARM_L, '#e8ecf5');
  sdk.setPartColor(sdk.P.HAND_R, '#ffd28a');
  sdk.setPartColor(sdk.P.HAND_L, '#ffd28a');
  sdk.setPartColor(sdk.P.THIGH_R, '#2f5bc4');
  sdk.setPartColor(sdk.P.THIGH_L, '#2f5bc4');
  sdk.setPartColor(sdk.P.SHIN_R, '#e8ecf5');
  sdk.setPartColor(sdk.P.SHIN_L, '#e8ecf5');
  sdk.setPartColor(sdk.P.FOOT_R, '#37415c');
  sdk.setPartColor(sdk.P.FOOT_L, '#37415c');

  // 2) Canvas 绘制头部（模板 80x88 = 头部 20x22 的 4 倍，锚点在顶边中点）
  const cv = sdk.createCanvas(80, 88);
  const g = cv.getContext('2d');
  // 底色圆角
  g.fillStyle = '#ffd9a8';
  g.beginPath();
  g.roundRect(0, 0, 80, 88, 16);
  g.fill();
  // 头发（画布底部 = 渲染后的头顶）
  g.fillStyle = '#3b2f2a';
  g.beginPath();
  g.roundRect(0, 62, 80, 26, { tl: 0, tr: 0, bl: 10, br: 10 });
  g.fill();
  // 眼睛（画布 +x 侧 = 面朝方向）
  g.fillStyle = '#26303f';
  g.beginPath(); g.arc(26, 42, 6, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(56, 42, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(23, 40, 2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(53, 40, 2, 0, Math.PI * 2); g.fill();
  // 嘴
  g.strokeStyle = '#a4552f';
  g.lineWidth = 3;
  g.beginPath(); g.arc(40, 56, 8, 0.2, Math.PI - 0.2); g.stroke();

  sdk.setPartTextureFromCanvas(sdk.P.HEAD, cv);

  // 3) 缩放也可以玩
  sdk.setPartScale(sdk.P.HAND_R, 1.2, 1.2);
});

sdk.onTick(() => {
  // 双手下垂微屈，站着展示外观
  sdk.setJointMotor(sdk.P.UPPERARM_R, 6, 120);
  sdk.setJointMotor(sdk.P.UPPERARM_L, 6, 120);
  sdk.setJointMotor(sdk.P.FOREARM_R, 14, 120);
  sdk.setJointMotor(sdk.P.FOREARM_L, 14, 120);
});`,
  '07_full_fighter': `// 完整格斗 AI：走位、出拳、踢腿、格挡，被击倒后起身。
// 状态很少——一个攻击计时器 + 一个冷却计时器，其余靠读对手位置现算。
// 手动操作：A / D 移动，J 出拳，K 踢腿，S 格挡。

const st = { atk: 0, kind: 'punch', fired: false, cd: 0, phase: 0 };

function tryAttack(kind) {
  if (st.atk <= 0 && st.cd <= 0) {
    st.kind = kind;
    st.atk = kind === 'punch' ? 0.34 : 0.5;
    st.fired = false;
  }
}

sdk.bindKey('j', () => tryAttack('punch'));
sdk.bindKey('k', () => tryAttack('kick'));

sdk.onEvent((e) => {
  if (e.type === 'hit') st.cd = Math.max(st.cd, 0.15);  // 挨打后稍缓，形成攻防节奏
  if (e.type === 'dealHit') st.cd = 0.25;
});

// 迈步姿态：walk = true 时双腿反相摆动
function legs(walk, dt) {
  const s = walk ? Math.sin(st.phase) : 0;
  const c = walk ? Math.cos(st.phase) : 0;
  if (walk) st.phase += dt * 9;
  sdk.setJointMotor(sdk.P.THIGH_R, 6 + s * 24, 300);
  sdk.setJointMotor(sdk.P.SHIN_R, 10 + Math.max(0, c) * 34, 340);
  sdk.setJointMotor(sdk.P.THIGH_L, 6 - s * 24, 300);
  sdk.setJointMotor(sdk.P.SHIN_L, 10 + Math.max(0, -c) * 34, 340);
}

// 备战姿态：双拳护住面门
function guardPose() {
  sdk.setJointMotor(sdk.P.UPPERARM_R, 55, 320);
  sdk.setJointMotor(sdk.P.FOREARM_R, 95, 320);
  sdk.setJointMotor(sdk.P.UPPERARM_L, 55, 320);
  sdk.setJointMotor(sdk.P.FOREARM_L, 95, 320);
}

// 执行一轮攻击；返回 true 表示本帧仍在出招
function attack(dt) {
  if (st.atk <= 0) return false;
  st.atk -= dt;
  const t = 1 - st.atk / (st.kind === 'punch' ? 0.34 : 0.5);
  if (st.kind === 'punch') {
    legs(false, dt);
    if (t < 0.35) {
      sdk.setJointMotor(sdk.P.UPPERARM_R, 20, 400);
      sdk.setJointMotor(sdk.P.FOREARM_R, 130, 500);
    } else if (!st.fired) {
      sdk.setJointMotor(sdk.P.UPPERARM_R, 95, 900);
      sdk.setJointMotor(sdk.P.FOREARM_R, 5, 1100, 4200);
      st.fired = true;
    } else {
      sdk.setJointMotor(sdk.P.UPPERARM_R, 55, 500);
      sdk.setJointMotor(sdk.P.FOREARM_R, 95, 500);
    }
  } else {
    sdk.setJointMotor(sdk.P.THIGH_L, 4, 280);
    sdk.setJointMotor(sdk.P.SHIN_L, 8, 280);
    if (t < 0.35) {
      sdk.setJointMotor(sdk.P.THIGH_R, 85, 520);
      sdk.setJointMotor(sdk.P.SHIN_R, 100, 520);
    } else if (!st.fired) {
      sdk.setJointMotor(sdk.P.SHIN_R, 2, 1100, 6200);
      sdk.setJointMotor(sdk.P.FOOT_R, 20, 400);
      st.fired = true;
    } else {
      sdk.setJointMotor(sdk.P.THIGH_R, 30, 420);
      sdk.setJointMotor(sdk.P.SHIN_R, 55, 420);
    }
  }
  return true;
}

sdk.onTick((dt) => {
  st.cd = Math.max(0, st.cd - dt);
  const self = sdk.getSelfState();
  if (self.state === 'ko') return;

  // ---- 被击倒：蹬腿 + 抬躯干，把辅助调高帮助起身 ----
  if (self.state === 'down') {
    sdk.setBalanceStrength(1.4);
    sdk.setJointMotor(sdk.P.THIGH_R, 30, 400);
    sdk.setJointMotor(sdk.P.THIGH_L, 30, 400);
    sdk.setJointMotor(sdk.P.SHIN_R, 60, 500);
    sdk.setJointMotor(sdk.P.SHIN_L, 60, 500);
    sdk.setJointMotor(sdk.P.TORSO, -20, 300);
    sdk.applyRootForce(0, 4500);
    return;
  }
  sdk.setBalanceStrength(1);
  guardPose();

  const opp = sdk.getOpponentState();
  const dx = sdk.getOpponentBonePosition(sdk.P.TORSO).x - sdk.getBonePosition(sdk.P.TORSO).x;
  const face = Math.sign(dx) || 1;
  const dist = Math.abs(dx);

  // ---- 出招中：向前压上 ----
  if (attack(dt)) {
    sdk.setRootVelocity(dist > 60 ? face * 150 : 0, 0);
    return;
  }

  // ---- 残血且对手贴身：抬臂格挡 ----
  if (self.hp < 40 && dist < 110) {
    sdk.setJointMotor(sdk.P.UPPERARM_R, 80, 500);
    sdk.setJointMotor(sdk.P.FOREARM_R, 65, 500);
    sdk.setJointMotor(sdk.P.UPPERARM_L, 80, 500);
    sdk.setJointMotor(sdk.P.FOREARM_L, 65, 500);
    sdk.stopMoving();
    return;
  }

  // ---- 走位：远了逼近，进圈就出招 ----
  if (dist > 95) {
    legs(true, dt);
    sdk.setJointMotor(sdk.P.UPPERARM_R, 30, 220);
    sdk.setJointMotor(sdk.P.UPPERARM_L, 30, 220);
    sdk.setRootVelocity(face * 220, 0);
  } else {
    legs(false, dt);
    sdk.stopMoving();
    if (opp.state !== 'ko') tryAttack(Math.random() < 0.6 ? 'punch' : 'kick');
  }
});`,
}

/** 新建预设的初始代码（zh-CN） */
export const STARTER_CODE = `// 新预设：从「站着」开始。平衡辅助已经帮你站稳，你只需要决定「做什么」。
// 左侧是实时预览：改完代码点右上角「重启预览」就能看到效果。
// 完整 API 见右侧「SDK 文档」标签页；sdk.P.* 是部件枚举。

sdk.log('新预设已加载');

sdk.onTick((dt) => {
  // 双手自然下垂微屈
  sdk.setJointMotor(sdk.P.UPPERARM_R, 6, 120);
  sdk.setJointMotor(sdk.P.UPPERARM_L, 6, 120);
  sdk.setJointMotor(sdk.P.FOREARM_R, 14, 120);
  sdk.setJointMotor(sdk.P.FOREARM_L, 14, 120);
});`
