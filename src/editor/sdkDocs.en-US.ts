import { ALL_PARTS } from '../skeleton/partDefs'

/** en-US mirror of the in-app "SDK Docs" tab, kept in sync with docs/SDK.md */
export const SDK_DOCS_HTML = `
<h2>Joint Arena SDK Docs</h2>
<p>Player code runs in a <b>Web Worker sandbox</b> and talks to the main thread through messages.
The only entry point is the global object <code class="mono">sdk</code>.
There is no DOM / window / document. An infinite loop cannot freeze the game, but that fighter’s logic is stopped automatically.</p>

<h3>Quick start</h3>
<pre>sdk.onInit(() => {
  sdk.log('Init runs once');
  sdk.setPartColor(sdk.P.TORSO, '#4f8cff');   // tint the torso
});

sdk.onTick((dt) => {                       // every physics frame (60Hz)
  sdk.setJointMotor(sdk.P.UPPERARM_R, 60, 300); // raise the right arm
});

sdk.bindKey('j', () => {                   // key binding (event driven)
  sdk.setJointMotor(sdk.P.FOREARM_R, 5, 900); // straight elbow = punch
});</pre>

<h3>Unified part keys (sdk.P)</h3>
<p>Actions (joint drive), looks (color / texture) and sensors (position / contact / ray) share <b>one set of part keys</b>.
Use the enum <code class="mono">sdk.P.*</code> instead of typing strings:</p>
<pre>sdk.P.HIP · sdk.P.TORSO · sdk.P.HEAD
sdk.P.UPPERARM_R · sdk.P.FOREARM_R · sdk.P.HAND_R      // left side uses _L
sdk.P.THIGH_R · sdk.P.SHIN_R · sdk.P.FOOT_R</pre>
<p class="muted small">An enum value is the part name (<code class="mono">sdk.P.FOREARM_R</code> is <code class="mono">'forearm_R'</code>).
<b>An action rotates that part around its parent part</b>: P.FOREARM_R bends the elbow, P.SHIN_R bends the knee, P.TORSO bends the spine, P.HEAD turns the head;
P.HIP is the root part and has no drivable joint (use setRootVelocity to move).</p>

<h3>Position and angle conventions</h3>
<ul>
  <li>World space: x goes right, <b>y goes up</b>, the ground is y=0, one unit is one pixel.</li>
  <li>Joint angles: <b>0° = the rest pose</b> (standing with the arms hanging loose). Positive follows the fighter’s facing: shoulders and hips flex forward, elbows and knees bend.</li>
  <li>Part orientation: the part axis runs from the anchor to the tip. In the rest pose every part axis points down (-90°);
  the head is anchored at the top of the head, the foot at the ankle.</li>
</ul>

<h3>Lifecycle</h3>
<table>
  <tr><th>API</th><th>Description</th></tr>
  <tr><td class="mono">onInit(cb)</td><td>Runs once after the code loads</td></tr>
  <tr><td class="mono">onTick(cb(dt))</td><td>Runs every physics frame; dt is the frame interval in seconds</td></tr>
  <tr><td class="mono">onEvent(cb(e))</td><td>Event callback: roundStart / roundEnd / hit / dealHit / stateChange / keydown / keyup / mousedown / mouseup</td></tr>
  <tr><td class="mono">onDestroy(cb)</td><td>Runs when the code stops</td></tr>
</table>

<h3>Joint control (14 joints, unified part keys)</h3>
<p class="mono small">sdk.P.TORSO · sdk.P.HEAD · sdk.P.UPPERARM_R/L · sdk.P.FOREARM_R/L · sdk.P.HAND_R/L · sdk.P.THIGH_R/L · sdk.P.SHIN_R/L · sdk.P.FOOT_R/L</p>
<table>
  <tr><th>API</th><th>Description</th></tr>
  <tr><td class="mono">setJointMotor(part, targetAngle, speed=360, maxTorque?)</td><td>Servo motor: turn part toward the target angle at speed (deg/s); maxTorque caps the force</td></tr>
  <tr><td class="mono">setJointAngle(part, angle)</td><td>Set the angle directly (high-stiffness servo)</td></tr>
  <tr><td class="mono">rotateJoint(part, deltaAngle)</td><td>Rotate by a relative amount from the current angle</td></tr>
  <tr><td class="mono">getJointAngle(part)</td><td>Read the current angle (degrees)</td></tr>
  <tr><td class="mono">setJointTorque(part, torque)</td><td>Apply torque directly (this frame only)</td></tr>
  <tr><td class="mono">setJointLimits(part, min, max)</td><td>Narrow the angle limits (never past the anatomical hard limits)</td></tr>
</table>
<p class="muted small">Call setJointMotor again every frame; that is the recommended usage, a PD servo needs a constant stream of commands.
setJointTorque lasts one frame, so it also needs a call every frame.</p>

<h3>Bones and sensors</h3>
<table>
  <tr><th>API</th><th>Description</th></tr>
  <tr><td class="mono">getBonePosition(part)</td><td>World position of the part anchor {x, y}</td></tr>
  <tr><td class="mono">getBoneVelocity(part)</td><td>Part velocity {x, y} (px/s)</td></tr>
  <tr><td class="mono">getBoneRotation(part)</td><td>Angle of the part axis (degrees)</td></tr>
  <tr><td class="mono">getOpponentBonePosition(part)</td><td>Position of the opponent’s part</td></tr>
  <tr><td class="mono">getDistanceTo(part | 'opp:head')</td><td>Distance from your torso to the target part</td></tr>
  <tr><td class="mono">getContacts(part)</td><td>Contact list: 'ground' / 'wall_L' / 'P2:head' …</td></tr>
  <tr><td class="mono">raycast(origin, direction, distance)</td><td>Ray cast against both fighters’ part capsules plus the ground and walls. Returns {hit, distance, point, part}</td></tr>
</table>
<p class="mono small">Part keys: ${ALL_PARTS.map(p => `sdk.P.${p.toUpperCase()}`).join(' · ')}</p>

<h3>Input</h3>
<table>
  <tr><th>API</th><th>Description</th></tr>
  <tr><td class="mono">bindKey(key, cb)</td><td>Key press callback (key is lowercase, e.g. 'a' / 'arrowleft' / ' ')</td></tr>
  <tr><td class="mono">bindMouse(button, cb)</td><td>Mouse press callback ('left'|'middle'|'right')</td></tr>
  <tr><td class="mono">isKeyDown(key) / isMouseDown(button)</td><td>State query (poll inside onTick)</td></tr>
  <tr><td class="mono">getMousePosition()</td><td>Mouse position in world space</td></tr>
</table>
<p class="muted small">Key events are forwarded only while the code editor has no focus, so typing never moves the fighter. Clicking “▶ Run” or “↺ Reset round” gives focus back to the game, and keys work right away.</p>

<h3>Textures and appearance</h3>
<table>
  <tr><th>API</th><th>Description</th></tr>
  <tr><td class="mono">setPartColor(part, '#4f8cff' | 0x4f8cff)</td><td>Tint (multiplicative)</td></tr>
  <tr><td class="mono">setPartTexture(part, url)</td><td>Image texture (PNG/JPG/WebP, ≤512×512, cross-origin needs CORS)</td></tr>
  <tr><td class="mono">createCanvas(w, h)</td><td>Create an OffscreenCanvas (the sandbox has no DOM)</td></tr>
  <tr><td class="mono">setPartTextureFromCanvas(part, canvas)</td><td>Canvas texture (part size ×4 works well)</td></tr>
  <tr><td class="mono">setPartScale(part, sx, sy) / setPartOffset(part, ox, oy)</td><td>Scale / offset (ox runs along the part axis, oy points to the facing side)</td></tr>
  <tr><td class="mono">resetPart(part)</td><td>Restore the default white placeholder</td></tr>
</table>
<p class="muted small">Texture canvas spec: width = part width ×4, height = part length ×4, anchor at the top edge midpoint.
Draw the content straight down; it rotates with the part when rendered. The +x side of the canvas is the fighter’s facing side.</p>

<h3>Tools and extras</h3>
<table>
  <tr><th>API</th><th>Description</th></tr>
  <tr><td class="mono">log(obj) / logWarn(obj)</td><td>Print to the console (8 lines per frame); console.log / warn / error are routed here too</td></tr>
  <tr><td class="mono">getTime() / getDeltaTime()</td><td>Total time / frame interval</td></tr>
  <tr><td class="mono">getHp() / getOpponentHp() / getSelfState() / getOpponentState()</td><td>Health and state (normal/stun/down/ko)</td></tr>
  <tr><td class="mono">setBalanceStrength(0 ~ 1.6)</td><td>Balance assist strength (the built-in pose system, 0 = pure physics). It already keeps the fighter standing, so you do not write a stance controller</td></tr>
  <tr><td class="mono">setRootVelocity(vx, vy) / stopMoving()</td><td>Root movement assist (the recommended way to move); a positive vy jumps, e.g. <span class="mono">(0, 430)</span></td></tr>
  <tr><td class="mono">applyRootForce(fx, fy)</td><td>Push the hip directly (this frame only)</td></tr>
  <tr><td class="mono">getRoundTime()</td><td>Time left in the round</td></tr>
  <tr><td class="mono">sdk.P</td><td>Unified part enum (shared by actions / looks / sensors); sdk.PARTS is the array of part names</td></tr>
</table>

<h3>Making it walk like a human</h3>
<p>The balance assist keeps the fighter standing. You only line up two things: <b>movement</b> and <b>the leg swing rhythm</b>.</p>
<pre>let phase = 0;

sdk.onTick((dt) =&gt; {
  const dir = (sdk.isKeyDown('d') ? 1 : 0) - (sdk.isKeyDown('a') ? 1 : 0);
  const walking = dir !== 0;
  if (walking) phase += dt * 9;              // swing faster, walk faster

  const s = walking ? Math.sin(phase) : 0;
  const c = walking ? Math.cos(phase) : 0;
  sdk.setJointMotor(sdk.P.THIGH_R, 6 + s * 24, 300);              // swings forward
  sdk.setJointMotor(sdk.P.SHIN_R, 10 + Math.max(0, c) * 34, 340); // knee bends, foot lifts
  sdk.setJointMotor(sdk.P.THIGH_L, 6 - s * 24, 300);              // left leg, opposite phase
  sdk.setJointMotor(sdk.P.SHIN_L, 10 + Math.max(0, -c) * 34, 340);

  sdk.setRootVelocity(dir * 220, 0);         // the root assist moves you
});</pre>
<p class="muted small">Match the swing frequency (<span class="mono">dt * 9</span>) to the movement speed (<span class="mono">220</span>),
otherwise the feet slip along the ground. Bend the knee while the leg swings forward, or it reads as ice skating. Jump with
<span class="mono">sdk.setRootVelocity(0, 430)</span>; the hover spring moves out of the way on its own.</p>

<h3>Limits</h3>
<ul>
  <li>A frame allows at most 500 SDK commands and 8 log lines; more than that errors or is dropped.</li>
  <li>If a tick callback stays silent for 600ms (an infinite loop), that fighter’s logic stops and the console shows “Infinite loop stopped”.</li>
  <li>After 5 runtime errors in a row, that fighter’s logic pauses (“Paused on error”); click “↺ Reset round” to recover.</li>
</ul>
`
