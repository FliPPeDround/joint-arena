import type { FighterId } from '../config'
import type { DisplayMsg } from '../i18n'
import type { NetworkAdapter } from '../net/networkStub'
import type { FighterSnapshot, SdkCommand, Snapshot } from '../sdk/protocol'
import type { SandboxHostHooks } from '../sdk/sandboxHost'
import type { DebugToggles, GameApi } from '../stores/game'
import type { DBFactory } from '../types/dragonBonesApi'
// @env browser
import RAPIER from '@dimforge/rapier2d-compat'
import * as PIXI from 'pixi.js'
import { watch } from 'vue'
import { CombatSystem } from '../combat/combatSystem'
import { CFG } from '../config'
import { clamp } from '../core/utils'
import { botCode } from '../editor/examples'
import { errorToText, msg, rawMsg } from '../i18n'
import { InputSystem } from '../input/inputSystem'
import { createNetworkAdapter } from '../net/networkStub'
import { BALANCE } from '../physics/fighterBody'
import { PhysicsWorld } from '../physics/physicsWorld'
import { DebugView } from '../render/debugView'
import { FighterView } from '../render/fighterView'
import { arenaCamX, GameApp } from '../render/gameApp'
import { SandboxHost } from '../sdk/sandboxHost'
import { SdkError } from '../sdk/sdkError'
import { ALL_JOINTS, ALL_PARTS } from '../skeleton/partDefs'
import { codes, gameApi, gameStore, pushConsole, resetSessionState, setBoundKeys, setStatus } from '../stores/game'
import { recordMatchResult } from '../stores/profile'

const FIGHTERS: FighterId[] = ['P1', 'P2']

export interface CreateGameOptions {
  /**
   * 单人预览模式（编辑页）：只渲染 P1，P2 停到场地外并隐藏，不跑战斗规则，
   * 相机跟随 P1。默认 false = 完整对战。
   */
  solo?: boolean
  /**
   * 大厅背景演示局：双内建 AI 演武 —— 不接键鼠输入（留给大厅菜单）、
   * 不写入玩家档案，分出胜负后自动重开。
   */
  demo?: boolean
}

/**
 * 装配整个游戏引擎（渲染 / 物理 / 沙箱 / 回合控制），UI 通过 {@link GameApi} 驱动它。
 * 引擎到 UI 的反馈全部写入响应式 store。引擎与舞台画布随应用常驻（GameStage），
 * 场景切换通过 {@link GameApi.setMode} 热切换玩法模式，不走 dispose / 重建。
 */
export async function createGame(canvas: HTMLCanvasElement, opts: CreateGameOptions = {}): Promise<void> {
  /** 玩法模式（可热切换）：solo = 编辑页单人预览，demo = 大厅演武，缺省 = 完整对抗 */
  const mode = { solo: opts.solo ?? false, demo: opts.demo ?? false }
  /** 当前模式下的活跃角色：预览只跑 P1（P2 停在场外且不渲染） */
  const activeFighters = (): FighterId[] => mode.solo ? ['P1'] : FIGHTERS
  resetSessionState()

  // 1) Rapier WASM
  await RAPIER.init()

  // 2) 为 vendored DragonBones 适配器准备 PIXI 全局（Pixi v4 兼容 shim），
  //    然后动态加载运行时（其模块顶层就需要 PIXI.Container）
  ;(globalThis as unknown as { PIXI: unknown }).PIXI = Object.assign({}, PIXI, {
    mesh: {
      Mesh: class PixiMeshShim { static DRAW_MODES: Record<string, number> = { TRIANGLES: 0 } },
    },
    // PixiFactory 构造时会把时钟挂到 v4 的 PIXI.ticker.shared；我们手动驱动
    // advanceTime，提供一个无操作 ticker 即可。
    ticker: { shared: { add() {}, remove() {}, elapsedMS: 16.666 } },
  })
  const DB = (await import('../vendor/dragonBones')).default

  // 3) 场景
  const app = new GameApp(canvas)
  const factory: DBFactory = new DB.PixiFactory()
  const physics = new PhysicsWorld()
  const views: Record<FighterId, FighterView> = {
    P1: new FighterView(factory, app.atlasTexture, app.atlasJson, 'P1', 1),
    P2: new FighterView(factory, app.atlasTexture, app.atlasJson, 'P2', -1),
  }
  app.addFighterView(views.P1)
  app.addFighterView(views.P2)
  // 预览模式 P2 不渲染（模式热切换时再点亮，画布与骨架容器常驻）

  // 预览模式：P2 停到右侧场地外（地面向外延伸 700px，仍在地面上站立休眠），
  // 不渲染、无沙箱，相机只看 P1。combat.reset 会把 P2 拉回出生点，故重置后需再停一次。
  function parkP2(): void {
    for (const part of Object.values(physics.p2.parts)) {
      const t = part.body.translation()
      part.body.setTranslation({ x: t.x + 1200, y: t.y }, true)
    }
  }
  ;(views.P2.container as unknown as PIXI.Container).visible = !mode.solo
  if (mode.solo)
    parkP2()

  // HUD：直接写入响应式 store（同值赋值不会触发 Vue 副作用，每帧写也廉价）
  const hud = {
    banner(main: DisplayMsg, sub: DisplayMsg | null = null): void {
      gameStore.hud.banner = { visible: true, main, sub }
    },
    hideBanner(): void {
      gameStore.hud.banner.visible = false
    },
  }
  const combat = new CombatSystem(physics, app, hud, views)
  const debug = new DebugView(app.debugLayer)
  // 输入系统跟模式走：大厅演武不接输入（键鼠属于大厅菜单与表单，不能被引擎拦截），
  // 编辑预览 / 对战才接管输入；模式热切换时按需装卸
  let input: InputSystem | null = mode.demo ? null : new InputSystem(canvas, (sx, sy) => app.screenToWorld(sx, sy))

  // 4) 沙箱
  const sandboxHooks: SandboxHostHooks = {
    applyCmds: (id, cmds) => applyCmds(id, cmds),
    // 玩家 sdk.log 的输出是自由文本，按原文进控制台；引擎自己的话一律走消息键，切语言即时重译
    onLog: (id, text, level) => pushConsole(level, rawMsg(text), id),
    onError: (id, message, fatal) => {
      pushConsole('error', message, id)
      setStatus(id, fatal ? 'status.pausedOnError' : 'status.runtimeError', true)
    },
    onStall: (id) => {
      pushConsole('error', msg('console.stallKilled'), id)
      setStatus(id, 'status.loopKilled', true)
    },
    onReady: (id) => {
      pushConsole('info', msg('console.codeLoaded'), id)
      setStatus(id, 'status.running')
    },
    onBoundKeys: (id, keys) => setBoundKeys(id, keys),
  }
  const sandboxes: Record<FighterId, SandboxHost> = {
    P1: new SandboxHost('P1', sandboxHooks),
    P2: new SandboxHost('P2', sandboxHooks),
  }

  // 5) 指令落地
  const texCache = new Map<string, PIXI.Texture>()

  async function loadTextureFromUrl(url: string): Promise<PIXI.Texture> {
    const cached = texCache.get(url)
    if (cached)
      return cached
    const resp = await fetch(url)
    if (!resp.ok)
      throw new SdkError('textureHttp', { status: resp.status })
    const type = resp.headers.get('content-type') ?? ''
    if (/svg/i.test(type) || /\.svg(?:\?|$)/i.test(url))
      throw new SdkError('textureSvg')
    const blob = await resp.blob()
    const bmp = await createImageBitmap(blob)
    if (bmp.width > 1024 || bmp.height > 1024)
      throw new SdkError('textureTooBig', { w: bmp.width, h: bmp.height, cap: 1024 })
    const base = new PIXI.BaseTexture(bmp)
    const tex = new PIXI.Texture(base)
    texCache.set(url, tex)
    return tex
  }

  function applyCmds(id: FighterId, cmds: SdkCommand[]): void {
    const fighter = id === 'P1' ? physics.p1 : physics.p2
    const view = views[id]
    for (const cmd of cmds) {
      try {
        switch (cmd.c) {
          case 'setJointMotor': fighter.setJointMotor(cmd.joint, cmd.target, cmd.speed, cmd.maxTorque); break
          case 'setJointAngle': fighter.setJointAngle(cmd.joint, cmd.angle); break
          case 'rotateJoint': fighter.rotateJoint(cmd.joint, cmd.delta); break
          case 'setJointTorque': fighter.setJointTorque(cmd.joint, cmd.torque); break
          case 'setJointLimits': fighter.setJointLimits(cmd.joint, cmd.min, cmd.max); break
          case 'setBalance': fighter.balanceStrength = clamp(cmd.strength, 0, 1.6); break
          case 'applyRootForce': fighter.rootForce.fx += cmd.fx; fighter.rootForce.fy += cmd.fy; break
          case 'setRootVelocity': fighter.rootVelTarget = { active: true, vx: cmd.vx, vy: cmd.vy }; break
          case 'setPartColor': view.setPartColor(cmd.part, cmd.color); break
          case 'setPartTexture':
            loadTextureFromUrl(cmd.url)
              .then(tex => view.setPartTexture(cmd.part, tex))
              .catch((err) => {
                pushConsole('error', msg('console.textureCmdFailed', { part: cmd.part, msg: errorToText(err) }), id)
              })
            break
          case 'setPartBitmap': {
            const base = new PIXI.BaseTexture(cmd.bitmap)
            view.setPartTexture(cmd.part, new PIXI.Texture(base))
            break
          }
          case 'resetPart': view.resetPart(cmd.part); break
          case 'setPartScale': view.setPartScale(cmd.part, cmd.sx, cmd.sy); break
          case 'setPartOffset': view.setPartOffset(cmd.part, cmd.ox, cmd.oy); break
          case 'debugRay':
            debug.addRay({ ox: cmd.ox, oy: cmd.oy, dx: cmd.dx, dy: cmd.dy, dist: cmd.dist, hit: cmd.hit, hx: cmd.hx, hy: cmd.hy })
            break
        }
      }
      catch (err) {
        pushConsole('error', msg('console.cmdFailed', { cmd: cmd.c, msg: errorToText(err) }), id)
      }
    }
  }

  // 6) 快照
  let worldTime = 0
  let snapP1: FighterSnapshot
  let snapP2: FighterSnapshot

  function buildFighterSnapshots(): void {
    const keys: Record<string, boolean> = {}
    for (const k of input?.keys ?? []) keys[k] = true
    const mk = (fid: FighterId): FighterSnapshot => {
      const fighter = fid === 'P1' ? physics.p1 : physics.p2
      const joints: Record<string, number> = {}
      for (const j of ALL_JOINTS) joints[j] = Math.round(fighter.jointAngleDeg(j) * 10) / 10
      const bones: FighterSnapshot['bones'] = {}
      const contacts: Record<string, string[]> = {}
      for (const part of ALL_PARTS) {
        const [x, y] = fighter.partPivot(part)
        const v = fighter.partVelocity(part)
        bones[part] = {
          x: Math.round(x * 10) / 10,
          y: Math.round(y * 10) / 10,
          vx: Math.round(v.x),
          vy: Math.round(v.y),
          rot: Math.round(fighter.partRotationDeg(part) * 10) / 10,
        }
        contacts[part] = physics.contactsOf(fighter, part)
      }
      return { id: fid, hp: fighter.hp, facing: fighter.facing, state: fighter.state, joints, bones, contacts }
    }
    snapP1 = mk('P1')
    snapP2 = mk('P2')
  }

  function snapshotFor(id: FighterId, dt: number): Snapshot {
    return {
      time: worldTime,
      roundTime: Math.max(0, combat.roundTime),
      self: id === 'P1' ? snapP1 : snapP2,
      opp: id === 'P1' ? snapP2 : snapP1,
      keys: Object.fromEntries([...(input?.keys ?? [])].map(k => [k, true])),
      mouse: { ...(input?.mouse ?? { x: 0, y: 0, buttons: 0 }) },
      balanceStrength: (id === 'P1' ? physics.p1 : physics.p2).balanceStrength,
      dt,
    } as Snapshot
  }

  // 7) 回合控制（UI 面板与 __JA 钩子共用）
  // 演武局固定使用内建 AI 代码，绝不读写用户的 codes store（那是编辑器/对战的数据源）
  const codeOf = (id: FighterId): string => mode.demo ? botCode() : codes[id]
  // InputSystem 会丢弃 #editor-panel 内的按键（避免编辑器打字误触游戏），
  // 点完「运行 / 重置回合」后焦点仍留在面板按钮上，会把后续 bindKey 按键全部吞掉，
  // 所以每次启动/重置时把焦点还给页面。
  function releasePanelFocus(): void {
    const el = document.activeElement
    if (el instanceof HTMLElement && el.closest('#editor-panel'))
      el.blur()
  }

  function runAll(): void {
    releasePanelFocus()
    for (const id of activeFighters()) {
      sandboxes[id].start(codeOf(id))
      setStatus(id, 'status.loading')
    }
    pushConsole('sys', msg(mode.solo ? 'console.runSolo' : 'console.runBoth'))
    resetRound()
  }

  function stopAll(): void {
    for (const id of FIGHTERS) {
      sandboxes[id].stop()
      setStatus(id, 'status.idle')
    }
    physics.p1.clearMotors()
    physics.p2.clearMotors()
    pushConsole('sys', msg('console.stoppedAll'))
  }

  /** 只重摆站位（不含沙箱启动）：场景切换 / 需要静止开局时使用 */
  function reposition(): void {
    combat.reset()
    if (mode.solo)
      parkP2()
  }

  function resetRound(): void {
    releasePanelFocus()
    reposition()
    for (const id of activeFighters()) {
      const sb = sandboxes[id]
      if (!sb.running || !sb.enabled) {
        sb.start(codeOf(id))
        setStatus(id, 'status.loading')
      }
    }
    pushConsole('sys', msg('console.roundReset'))
  }

  // 8) 主循环（固定时间步）
  const isM0 = new URLSearchParams(location.search).get('mode') === 'm0'
  let acc = 0
  let last = performance.now()
  let m0Time = 0
  /** 演示局：分出胜负后安排自动重开的 worldTime 时刻（0 = 无待重开） */
  let demoResetAt = 0
  /** 演示局镜头状态：中线 x 与取景缩放的慢速跟随 */
  const demoCam = { x: 0, s: 1 }

  function gameStep(dt: number): void {
    worldTime += dt
    // 演示局：胜负分出后停顿几秒，再自动开下一场
    if (mode.demo && demoResetAt && worldTime >= demoResetAt) {
      demoResetAt = 0
      resetRound()
    }
    const now = performance.now()
    // 应用已收到的指令
    for (const id of activeFighters()) {
      const cmds = sandboxes[id].update(now)
      if (cmds.length)
        applyCmds(id, cmds)
    }
    // 输入 → 沙箱（演武局无输入系统）
    const evs = input?.drainEvents() ?? []
    for (const id of activeFighters()) sandboxes[id].sendEvents(evs)
    // 快照 + tick
    for (const id of activeFighters()) sandboxes[id].sendTick(dt, snapshotFor(id, dt))
    // 物理 + 战斗（预览模式不跑战斗规则：无伤害 / 无 KO / 回合不倒计时）
    physics.step()
    // 战斗事件 → onEvent
    for (const id of FIGHTERS) sandboxes[id].sendSdkEvents(combat.drainEvents(id))
    if (!mode.solo)
      combat.step(dt)
  }

  function loop(): void {
    try {
      loopInner()
    }
    catch (err) {
      (window as unknown as Record<string, unknown>).__loopErr = (err instanceof Error ? err.stack : String(err))
      console.error('loop error:', err)
    }
  }

  function loopInner(): void {
    const now = performance.now()
    let frameDt = (now - last) / 1000
    last = now
    frameDt = Math.min(frameDt, 0.1)

    if (isM0) {
      // M0 模式：DragonBones 管线验证，无物理
      m0Time += frameDt
      views.P1.applyPose(views.P1.demoDrivePose(m0Time))
      views.P2.applyPose(views.P2.demoDrivePose(m0Time + 1.2))
      const s = (app.canvasH / CFG.viewWorldH) * 1.35
      app.applyCameraTransform(0, s, app.canvasH * 0.9)
      app.render()
      return
    }

    acc += frameDt
    let steps = 0
    while (acc >= CFG.fixedDt && steps < 4) {
      acc -= CFG.fixedDt
      steps++
      buildFighterSnapshots()
      gameStep(CFG.fixedDt)
    }

    // 渲染同步：固定时间步之间的位姿插值（alpha = 累加器内的剩余比例）
    const renderAlpha = Math.min(1, acc / CFG.fixedDt)
    for (const id of activeFighters()) {
      const fighter = id === 'P1' ? physics.p1 : physics.p2
      views[id].applyPose(views[id].poseInterpolated(fighter, renderAlpha))
    }
    const p1x = physics.p1.partCenter('hip').x
    // 预览模式相机只看 P1（P2 已停到场外）
    const p2x = mode.solo ? p1x : physics.p2.partCenter('hip').x
    const topY = mode.solo
      ? physics.p1.partCenter('head').y
      : Math.max(physics.p1.partCenter('head').y, physics.p2.partCenter('head').y)
    if (mode.demo) {
      // 演武局专属镜头：贴近交战区（世界高约 480px 的取景）、中线缓移、
      // 地面线静息在画面 67% 高处 —— 主菜单背景要的是沉静的贴身取景，不是对战镜头
      demoCam.x += ((p1x + p2x) / 2 - demoCam.x) * 0.04
      const targetS = Math.max(0.9, Math.min(1.8, app.canvasH / 480))
      demoCam.s += (targetS - demoCam.s) * 0.04
      const cx = arenaCamX(demoCam.x, app.canvasW / 2 / demoCam.s)
      app.applyCameraTransform(cx, demoCam.s, app.canvasH * 0.67)
    }
    else {
      app.updateCamera(app.canvasW, app.canvasH, p1x, p2x, topY)
    }
    debug.draw(physics.p1, physics.p2)
    debug.tick(frameDt)
    app.tickFx(frameDt)

    // HUD 状态 → store（预览页无 HUD）
    if (!mode.solo) {
      gameStore.hud.hp.P1 = physics.p1.hp
      gameStore.hud.hp.P2 = physics.p2.hp
      gameStore.hud.roundTime = combat.roundTime
      gameStore.hud.state.P1 = physics.p1.state
      gameStore.hud.state.P2 = physics.p2.state
      // 分出胜负 → store + 用户档案（演武局不计档，reset 后 winner 归 null，下一局重新计）
      if (combat.winner !== gameStore.matchWinner) {
        gameStore.matchWinner = combat.winner
        if (combat.winner && !mode.demo)
          recordMatchResult(combat.winner)
        if (mode.demo && combat.winner)
          demoResetAt = worldTime + 2.5
      }
    }

    app.render()
  }

  const onResize = () => app.resize()
  app.app.ticker.add(loop)
  window.addEventListener('resize', onResize)

  // 9) 在线对战接口预留：本期为本地回环桩，联机时替换 adapter（见 src/net/networkStub.ts）
  const net: NetworkAdapter = createNetworkAdapter()
  net.onMessage((msg) => {
    if (msg.kind === 'commands')
      applyCmds(msg.fighterId, msg.cmds)
  })

  // 10) 设置页的调试开关与引擎同步（dispose 时停掉）
  const stopDebugWatch = watch(gameStore.debug, (v) => {
    debug.setEnabled({ ...v })
  })

  /**
   * 场景模式热切换（世界与画布常驻，UI 通过它换玩法而不是重建引擎）：
   * 改写玩法模式、按需装卸输入系统、镜头跨制式交接。
   * run = 切完立即开局（演武 / 预览 / 带 auto 的训练局）；否则只重摆站位，
   * 沙箱保持停止，等玩家手动开局。
   */
  function setMode(next: CreateGameOptions, run = false): void {
    const solo = next.solo ?? false
    const demo = next.demo ?? false
    if (solo === mode.solo && demo === mode.demo)
      return
    stopAll()
    // 镜头制式交接：对战/预览相机 ↔ 演武相机互播取景，切换时镜头连续滑移而非跳切
    if (demo && !mode.demo) {
      demoCam.x = app.cameraState.x
      demoCam.s = app.cameraState.scale
    }
    else if (!demo && mode.demo) {
      app.seedCamera(demoCam.x, demoCam.s, app.canvasH * 0.67)
    }
    mode.solo = solo
    mode.demo = demo
    demoResetAt = 0
    if (demo) {
      input?.dispose()
      input = null
    }
    else {
      input ??= new InputSystem(canvas, (sx, sy) => app.screenToWorld(sx, sy))
    }
    ;(views.P2.container as unknown as PIXI.Container).visible = !solo
    if (run)
      runAll()
    else
      reposition()
  }

  // 11) UI → 引擎操作接口
  let disposed = false
  gameApi.value = {
    run: runAll,
    stop: stopAll,
    reset: resetRound,
    setMode,
    setDebug: (toggles: Partial<DebugToggles>) => debug.setEnabled(toggles),
    previewPartColor: (part, color) => {
      for (const id of FIGHTERS) {
        try { views[id].setPartColor(part, color) }
        catch { /* ignore */ }
      }
    },
    resetPart: (part) => {
      for (const id of FIGHTERS) {
        try { views[id].resetPart(part) }
        catch { /* ignore */ }
      }
    },
    getAtlasFrame: part => app.atlas.frames[part] ?? null,
    getDefaultTextureSource: () => app.atlas.canvas,
    dispose: () => {
      if (disposed)
        return
      disposed = true
      stopDebugWatch()
      for (const id of FIGHTERS) sandboxes[id].stop()
      window.removeEventListener('resize', onResize)
      input?.dispose()
      app.app.ticker.stop()
      app.dispose()
      delete (window as unknown as Record<string, unknown>).__JA
      gameApi.value = null
      gameStore.booted = false
    },
  }

  // 12) 自动化测试钩子
  Object.assign(window as unknown as Record<string, unknown>, {
    __JA: buildTestHooks(),
  })

  function buildTestHooks(): Record<string, unknown> {
    return {
      run: runAll,
      stop: stopAll,
      reset: resetRound,
      arm: views.P1.container.armature,
      jointProto(id: 'P1' | 'P2'): unknown {
        const f = id === 'P1' ? physics.p1 : physics.p2
        let proto = Object.getPrototypeOf(f.joints.spine)
        const names: string[] = []
        while (proto) {
          names.push(...Object.getOwnPropertyNames(proto).filter(n => n !== 'constructor'))
          proto = Object.getPrototypeOf(proto)
        }
        return [...new Set(names)].sort()
      },
      forceSync(): unknown {
        views.P1.applyPose(views.P1.poseFromBody(physics.p1))
        return views.P1.renderDbgPublic()
      },
      tune(gains: Record<string, number>): void {
        Object.assign(BALANCE, gains)
      },
      lab: {
        /** 停掉沙箱，直接用内建马达锁定站立姿态（隔离引擎实验） */
        stand(): void {
          for (const id of FIGHTERS) sandboxes[id].stop()
          combat.reset()
          for (const f of [physics.p1, physics.p2]) {
            f.balanceStrength = 1
            const M = (j: string, a: number, s = 300) => f.setJointMotor(j, a, s)
            M('knee_R', 0); M('knee_L', 0); M('hip_R', 0); M('hip_L', 0)
            M('ankle_R', 0); M('ankle_L', 0)
            M('spine', 0); M('neck', 0)
            M('shoulder_R', 5, 150); M('shoulder_L', 5, 150)
            M('elbow_R', 12, 150); M('elbow_L', 12, 150)
            M('wrist_R', 0, 100); M('wrist_L', 0, 100)
          }
        },
        ragdoll(): void {
          for (const f of [physics.p1, physics.p2]) { f.clearMotors(); f.balanceStrength = 0 }
        },
      },
      physics(): unknown {
        const p1 = physics.p1; const p2 = physics.p2
        const dev = (f: typeof p1) => {
          const r = f.parts.hip.body.rotation()
          return Math.round((((r - (-Math.PI / 2)) * 180) / Math.PI + 540) % 360 - 180)
        }
        const centers = (f: typeof p1) => {
          const out: Record<string, string> = {}
          for (const b of ['hip', 'torso', 'head', 'foot_R', 'foot_L']) {
            const t = f.parts[b].body.translation()
            out[b] = `${Math.round(t.x)},${Math.round(t.y)}`
          }
          return out
        }
        return {
          p1: { hipY: Math.round(p1.partCenter('hip').y), hipX: Math.round(p1.partCenter('hip').x), dev: dev(p1), state: p1.state, centers: centers(p1) },
          p2: { hipY: Math.round(p2.partCenter('hip').y), hipX: Math.round(p2.partCenter('hip').x), dev: dev(p2), state: p2.state, centers: centers(p2) },
        }
      },
      joints(id: 'P1' | 'P2'): Record<string, number> {
        const f = id === 'P1' ? physics.p1 : physics.p2
        const out: Record<string, number> = {}
        for (const j of ALL_JOINTS) out[j] = Math.round(f.jointAngleDeg(j))
        out.__hipY = Math.round(f.partCenter('hip').y)
        out.__bs = Math.round(f.balanceStrength * 100) / 100
        return out
      },
      jointInfo(id: 'P1' | 'P2', joint: string): unknown {
        const f = id === 'P1' ? physics.p1 : physics.p2
        const j = f.joints[joint]
        return {
          enabled: j.limitsEnabled(),
          min: +j.limitsMin().toFixed(3),
          max: +j.limitsMax().toFixed(3),
          rapierDeg: Math.round((f.jointAngleRapier(joint) * 180) / Math.PI),
          semDeg: Math.round(f.jointAngleDeg(joint)),
        }
      },
      motors(id: 'P1' | 'P2'): unknown {
        const f = id === 'P1' ? physics.p1 : physics.p2
        return Object.fromEntries(Object.entries(f.motors).map(([name, m]) => [
          name,
          { mode: m.mode, targetRad: +m.target.toFixed(3), speed: m.speed, maxTorque: Math.round(m.maxTorque) },
        ]))
      },
      renderDbg(id: 'P1' | 'P2'): unknown {
        const fighter = id === 'P1' ? physics.p1 : physics.p2
        const pose = views[id].poseFromBody(fighter)
        const spr = views[id].sprites
        const pick: Record<string, string> = {}
        for (const b of ['hip', 'torso', 'head', 'foot_R']) {
          const s = spr[b]
          pick[b] = `spr(${Math.round(s.position.x)},${Math.round(s.position.y)},r=${Math.round((s.rotation * 180) / Math.PI)}) pose(${Math.round(pose[b].px)},${Math.round(pose[b].py)})`
        }
        const layer = app.fighterLayer
        return {
          pick,
          layerScale: [layer.scale.x, layer.scale.y],
          layerPos: [Math.round(layer.position.x), Math.round(layer.position.y)],
          containerScale: [views[id].container.scale.x, views[id].container.scale.y],
        }
      },
      root(id: 'P1' | 'P2'): unknown {
        const f = id === 'P1' ? physics.p1 : physics.p2
        return {
          rootVel: { ...f.rootVelTarget },
          rootForce: { ...f.rootForce },
          balance: f.balanceStrength,
          hipVx: Math.round(f.partVelocity('hip').x),
        }
      },
      combat(): unknown {
        return { ...combat.diag }
      },
      net: {
        adapter: () => net.id,
        sendSnapshot(): void {
          buildFighterSnapshots()
          net.send({ kind: 'snapshot', seq: 0, snapshot: snapshotFor('P1', CFG.fixedDt) })
        },
        sendCommands(): void {
          // 示例：把一条本地指令投递到回环（联机时由远端玩家代码产生）
          net.send({
            kind: 'commands',
            seq: 0,
            fighterId: 'P1',
            cmds: [{ c: 'setBalance', strength: 1 }],
          })
        },
      },
      hurt(id: 'P1' | 'P2', n: number): void {
        const f = id === 'P1' ? physics.p1 : physics.p2
        f.hp = Math.max(0, f.hp - n)
      },
      pressKey(key: string, durationMs = 120): void {
        window.dispatchEvent(new KeyboardEvent('keydown', { key }))
        setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { key })), durationMs)
      },
      state(): unknown {
        return {
          p1: { hp: physics.p1.hp, state: physics.p1.state, x: physics.p1.partCenter('hip').x, y: physics.p1.partCenter('hip').y },
          p2: { hp: physics.p2.hp, state: physics.p2.state, x: physics.p2.partCenter('hip').x, y: physics.p2.partCenter('hip').y },
          roundTime: combat.roundTime,
          winner: combat.winner,
          running: combat.running,
        }
      },
    }
  }

  gameStore.booted = true
}
