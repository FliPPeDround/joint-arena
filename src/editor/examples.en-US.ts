import type { ExampleId } from './examples'

/** Example code (en-US): mirrors examples.zh-CN.ts one-to-one. Logic must stay identical; only comments and sdk.log text are translated */
export const EXAMPLE_CODES: Record<ExampleId, string> = {
  '01_standing': `// Standing example: nothing to write. The built-in balance assist keeps the fighter on its feet.
// Joint angle 0° = rest pose; positive = toward the fighter's own facing direction.
// To make it move, send the target part a target angle every frame from onTick.

sdk.onTick(() => {
  // Arms hang relaxed with a slight elbow bend, so it reads as alive
  sdk.setJointMotor(sdk.P.UPPERARM_R, 6, 120);
  sdk.setJointMotor(sdk.P.UPPERARM_L, 6, 120);
  sdk.setJointMotor(sdk.P.FOREARM_R, 14, 120);
  sdk.setJointMotor(sdk.P.FOREARM_L, 14, 120);
});`,
  '02_walk': `// Movement example: A / D move left and right, W jumps.
// The balance assist already keeps you upright. setRootVelocity drives the hips,
// the legs only swing. Match the swing rhythm to the speed and it looks like walking.

let phase = 0;      // gait phase
let jumpTime = 0;   // jump boost time left

sdk.onTick((dt) => {
  const dir = (sdk.isKeyDown('d') ? 1 : 0) - (sdk.isKeyDown('a') ? 1 : 0);
  const walking = dir !== 0;
  if (walking) phase += dt * 9;

  // Gait: the legs swing out of phase. The leg swinging forward bends its knee and lifts at the same time, otherwise it looks like ice-skating.
  const s = walking ? Math.sin(phase) : 0;
  const c = walking ? Math.cos(phase) : 0;
  sdk.setJointMotor(sdk.P.THIGH_R, 6 + s * 24, 300);
  sdk.setJointMotor(sdk.P.SHIN_R, 10 + Math.max(0, c) * 34, 340);
  sdk.setJointMotor(sdk.P.FOOT_R, -s * 8, 260);
  sdk.setJointMotor(sdk.P.THIGH_L, 6 - s * 24, 300);
  sdk.setJointMotor(sdk.P.SHIN_L, 10 + Math.max(0, -c) * 34, 340);
  sdk.setJointMotor(sdk.P.FOOT_L, s * 8, 260);

  // Arms swing opposite to the legs
  sdk.setJointMotor(sdk.P.UPPERARM_R, 6 - s * 18, 220);
  sdk.setJointMotor(sdk.P.UPPERARM_L, 6 + s * 18, 220);
  sdk.setJointMotor(sdk.P.FOREARM_R, 16, 220);
  sdk.setJointMotor(sdk.P.FOREARM_L, 16, 220);

  // Jump: allowed only while one foot still touches the ground, and the boost holds for a short window
  const grounded = sdk.getContacts(sdk.P.FOOT_R).includes('ground')
    || sdk.getContacts(sdk.P.FOOT_L).includes('ground');
  if (sdk.isKeyDown('w') && grounded && jumpTime <= 0) jumpTime = 0.28;
  jumpTime -= dt;
  sdk.setRootVelocity(dir * 220, jumpTime > 0 ? 430 : 0);
});`,
  '03_punch': `// Punch example: J throws the right straight. One punch runs three phases: pull back, extend, retract.

let atk = 0;        // seconds left in this punch
let fired = false;  // whether this punch has already extended

sdk.bindKey('j', () => {
  if (atk <= 0) { atk = 0.34; fired = false; }
});

sdk.onEvent((e) => {
  if (e.type === 'hit') sdk.log('Got hit -' + e.damage);
  if (e.type === 'dealHit') sdk.log('Landed -' + e.damage);
});

sdk.onTick((dt) => {
  // Ready stance: both fists up at the chest (send it every frame or other logic overwrites it)
  sdk.setJointMotor(sdk.P.UPPERARM_R, 55, 300);
  sdk.setJointMotor(sdk.P.FOREARM_R, 95, 300);
  sdk.setJointMotor(sdk.P.UPPERARM_L, 55, 300);
  sdk.setJointMotor(sdk.P.FOREARM_L, 95, 300);

  if (atk > 0) {
    atk -= dt;
    if (1 - atk / 0.34 < 0.4) {
      sdk.setJointMotor(sdk.P.FOREARM_R, 130, 500);        // pull back, load the arm
    } else if (!fired) {
      sdk.setJointMotor(sdk.P.UPPERARM_R, 95, 900);        // drive the shoulder forward
      sdk.setJointMotor(sdk.P.FOREARM_R, 5, 1100, 4000);   // elbow snaps straight: the punch lands
      fired = true;
    } else {
      sdk.setJointMotor(sdk.P.UPPERARM_R, 55, 500);        // retract
      sdk.setJointMotor(sdk.P.FOREARM_R, 95, 500);
    }
  }

  // Press toward the opponent while punching, stand still otherwise
  const d = sdk.getOpponentBonePosition(sdk.P.TORSO).x - sdk.getBonePosition(sdk.P.TORSO).x;
  sdk.setRootVelocity(atk > 0 && Math.abs(d) > 60 ? Math.sign(d) * 150 : 0, 0);
});`,
  '04_kick': `// Kick example: K kicks with the right leg (lift the knee → snap the shin → pull it back). The left leg is the support leg the whole time.

let atk = 0;
let fired = false;

sdk.bindKey('k', () => {
  if (atk <= 0) { atk = 0.5; fired = false; }
});

sdk.onTick((dt) => {
  // Support leg + upper body: left hand up to cover the head, right hand low to keep balance
  sdk.setJointMotor(sdk.P.THIGH_L, 4, 260);
  sdk.setJointMotor(sdk.P.SHIN_L, 8, 280);
  sdk.setJointMotor(sdk.P.UPPERARM_L, 60, 260);
  sdk.setJointMotor(sdk.P.FOREARM_L, 80, 260);
  sdk.setJointMotor(sdk.P.UPPERARM_R, -10, 260);
  sdk.setJointMotor(sdk.P.FOREARM_R, 30, 260);

  // Right leg hangs relaxed by default
  sdk.setJointMotor(sdk.P.THIGH_R, 4, 260);
  sdk.setJointMotor(sdk.P.SHIN_R, 8, 280);
  sdk.setJointMotor(sdk.P.FOOT_R, 0, 220);
  if (atk <= 0) return;

  atk -= dt;
  if (1 - atk / 0.5 < 0.35) {
    sdk.setJointMotor(sdk.P.THIGH_R, 85, 520);            // knee lift
    sdk.setJointMotor(sdk.P.SHIN_R, 100, 520);
  } else if (!fired) {
    sdk.setJointMotor(sdk.P.SHIN_R, 2, 1100, 6000);       // snap kick: the shin swings out
    sdk.setJointMotor(sdk.P.FOOT_R, 20, 400);
    fired = true;
  } else {
    sdk.setJointMotor(sdk.P.THIGH_R, 30, 420);            // pull the leg back
    sdk.setJointMotor(sdk.P.SHIN_R, 55, 420);
  }
});`,
  '05_guard': `// Guard example: hold S to raise both arms and block.
// Block rule: both forearms near vertical and the wrists above the hips, then incoming damage drops to 35%.

sdk.onTick(() => {
  const guard = sdk.isKeyDown('s');

  // While guarding, lift the arms and tuck the elbows to cover the face; hands low otherwise
  sdk.setJointMotor(sdk.P.UPPERARM_R, guard ? 80 : 30, 400);
  sdk.setJointMotor(sdk.P.FOREARM_R, guard ? 65 : 70, 400);
  sdk.setJointMotor(sdk.P.UPPERARM_L, guard ? 80 : 30, 400);
  sdk.setJointMotor(sdk.P.FOREARM_L, guard ? 65 : 70, 400);

  // While guarding, raise the balance assist a little to absorb the impact
  sdk.setBalanceStrength(guard ? 1.2 : 1);
  if (guard) sdk.stopMoving();
});`,
  '06_texture': `// Skin example: tint parts and paint a face on the head with an OffscreenCanvas.
// Part keys are the same ones the movement code uses: sdk.P.* (size specs live on the "Textures" tab).

sdk.onInit(() => {
  sdk.log('Skin example loaded');

  // 1) Flat tint
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

  // 2) Draw the head on a canvas (template 80x88 = the 20x22 head at 4x, anchor at the middle of the top edge)
  const cv = sdk.createCanvas(80, 88);
  const g = cv.getContext('2d');
  // rounded base color
  g.fillStyle = '#ffd9a8';
  g.beginPath();
  g.roundRect(0, 0, 80, 88, 16);
  g.fill();
  // hair (bottom of the canvas = top of the head after rendering)
  g.fillStyle = '#3b2f2a';
  g.beginPath();
  g.roundRect(0, 62, 80, 26, { tl: 0, tr: 0, bl: 10, br: 10 });
  g.fill();
  // eyes (canvas +x side = the facing direction)
  g.fillStyle = '#26303f';
  g.beginPath(); g.arc(26, 42, 6, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(56, 42, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(23, 40, 2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(53, 40, 2, 0, Math.PI * 2); g.fill();
  // mouth
  g.strokeStyle = '#a4552f';
  g.lineWidth = 3;
  g.beginPath(); g.arc(40, 56, 8, 0.2, Math.PI - 0.2); g.stroke();

  sdk.setPartTextureFromCanvas(sdk.P.HEAD, cv);

  // 3) Scale is fair game too
  sdk.setPartScale(sdk.P.HAND_R, 1.2, 1.2);
});

sdk.onTick(() => {
  // Hands down with a slight bend, just standing there showing the look
  sdk.setJointMotor(sdk.P.UPPERARM_R, 6, 120);
  sdk.setJointMotor(sdk.P.UPPERARM_L, 6, 120);
  sdk.setJointMotor(sdk.P.FOREARM_R, 14, 120);
  sdk.setJointMotor(sdk.P.FOREARM_L, 14, 120);
});`,
  '07_full_fighter': `// Full fight AI: footwork, punches, kicks, guard, and getting up after a knockdown.
// Very little state: one attack timer plus one cooldown timer. Everything else is computed from the opponent's position.
// Manual controls: A/D move, J punch, K kick, S guard.

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
  if (e.type === 'hit') st.cd = Math.max(st.cd, 0.15);  // short pause after taking a hit, sets the attack/defense rhythm
  if (e.type === 'dealHit') st.cd = 0.25;
});

// Step pose: when walk is true, the legs swing out of phase
function legs(walk, dt) {
  const s = walk ? Math.sin(st.phase) : 0;
  const c = walk ? Math.cos(st.phase) : 0;
  if (walk) st.phase += dt * 9;
  sdk.setJointMotor(sdk.P.THIGH_R, 6 + s * 24, 300);
  sdk.setJointMotor(sdk.P.SHIN_R, 10 + Math.max(0, c) * 34, 340);
  sdk.setJointMotor(sdk.P.THIGH_L, 6 - s * 24, 300);
  sdk.setJointMotor(sdk.P.SHIN_L, 10 + Math.max(0, -c) * 34, 340);
}

// Ready stance: both fists cover the face
function guardPose() {
  sdk.setJointMotor(sdk.P.UPPERARM_R, 55, 320);
  sdk.setJointMotor(sdk.P.FOREARM_R, 95, 320);
  sdk.setJointMotor(sdk.P.UPPERARM_L, 55, 320);
  sdk.setJointMotor(sdk.P.FOREARM_L, 95, 320);
}

// Run one attack; true means the attack is still live this frame
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

  // ---- Knocked down: push the legs out, lift the torso, raise the assist to stand back up ----
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

  // ---- Mid-attack: press forward ----
  if (attack(dt)) {
    sdk.setRootVelocity(dist > 60 ? face * 150 : 0, 0);
    return;
  }

  // ---- Low hp and the opponent is close: raise the arms to guard ----
  if (self.hp < 40 && dist < 110) {
    sdk.setJointMotor(sdk.P.UPPERARM_R, 80, 500);
    sdk.setJointMotor(sdk.P.FOREARM_R, 65, 500);
    sdk.setJointMotor(sdk.P.UPPERARM_L, 80, 500);
    sdk.setJointMotor(sdk.P.FOREARM_L, 65, 500);
    sdk.stopMoving();
    return;
  }

  // ---- Footwork: close the gap from far away, commit to an attack once in range ----
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

/** Starter code for a new preset (en-US) */
export const STARTER_CODE = `// New preset: start from standing. The balance assist already keeps you upright, so you only decide what to do.
// The left side is the live preview: edit the code, then click "Restart preview" in the top-right corner.
// The full API is on the "SDK Docs" tab on the right; sdk.P.* is the part enum.

sdk.log('New preset loaded');

sdk.onTick((dt) => {
  // Arms hang relaxed with a slight bend
  sdk.setJointMotor(sdk.P.UPPERARM_R, 6, 120);
  sdk.setJointMotor(sdk.P.UPPERARM_L, 6, 120);
  sdk.setJointMotor(sdk.P.FOREARM_R, 14, 120);
  sdk.setJointMotor(sdk.P.FOREARM_L, 14, 120);
});`
