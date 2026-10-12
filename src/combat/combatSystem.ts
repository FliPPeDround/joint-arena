import type { FighterId } from '../config'
import type { FighterBody } from '../physics/fighterBody'
import type { PhysicsWorld } from '../physics/physicsWorld'
import type { FighterView } from '../render/fighterView'
import type { GameApp } from '../render/gameApp'
import type { SdkEvent } from '../sdk/protocol'
import { CFG } from '../config'
import { clamp } from '../core/utils'
import { PARTS } from '../skeleton/partDefs'

/** 回合横幅的最小接口（UI 层负责呈现，原 DOM Hud 的子集） */
export interface CombatHud {
  banner: (main: string, sub?: string) => void
  hideBanner: () => void
}

interface FlashEntry {
  fighter: FighterId
  part: string
  until: number
  colorBefore: number
}

/**
 * 战斗规则：伤害判定（接触力事件）、部位三分类结算（攻击/防御/受击）、
 * 抬臂格挡、硬直、击退、倒地、胜负。
 *
 * 命中结算规则：
 *  - 只有攻击部位（双手双脚）能造成伤害：接触双方必须恰好一方是攻击部位；
 *  - 伤害走饱和曲线：基 = 上限 × 超力 / (超力 + 半程)，超力 = 接触力 − 阈值，
 *    轻蹭 1~3 点、扎实一拳 4~8 点，重拳饱和后不再线性暴涨，单次命中封顶；
 *  - 速度门槛：攻击/受击部件相对速度太低视为慢速推挤，不结算；
 *  - 打到防御部位（手臂/小腿）→ 0.1 倍伤害（格挡），多为 0（完全挡下）；
 *  - 打到受击部位 → 按 hurtMult：头 2.0 > 身体 1.0 > 屁股 0.8 > 大腿 0.6；
 *  - 抬臂格挡姿态再叠 ×0.35；
 *  - 冷却：同一攻击部件对同一角色 0.45s 一次，受击者另有 0.12s 无敌帧；
 *  - 硬直时长按伤害换算（重击控更久），上限 0.35s；
 *  - 击退冲量与伤害挂钩并封顶。
 */
export class CombatSystem {
  roundTime: number = CFG.roundTime
  roundOver = false
  winner: FighterId | 'draw' | null = null
  running = false
  private hitCooldown = new Map<string, number>()
  private victimCooldown: Record<FighterId, number> = { P1: 0, P2: 0 }
  private stunUntil: Record<FighterId, number> = { P1: 0, P2: 0 }
  private flashes: FlashEntry[] = []
  private eventQueue: Record<FighterId, SdkEvent[]> = { P1: [], P2: [] }
  private now = 0
  private lastDown: Record<FighterId, boolean> = { P1: false, P2: false }
  /** 诊断：接触对计数 / 最大接触力 / 命中记录 */
  diag = { pairs: 0, maxForce: 0, hits: [] as string[] }

  constructor(
    private physics: PhysicsWorld,
    private app: GameApp,
    private hud: CombatHud,
    private views: Record<FighterId, FighterView>,
  ) {}

  reset(): void {
    this.physics.p1.reset(-CFG.spawnX)
    this.physics.p2.reset(CFG.spawnX)
    this.roundTime = CFG.roundTime
    this.roundOver = false
    this.winner = null
    this.running = true
    this.hitCooldown.clear()
    this.victimCooldown = { P1: 0, P2: 0 }
    this.stunUntil = { P1: 0, P2: 0 }
    this.flashes = []
    this.lastDown = { P1: false, P2: false }
    this.hud.hideBanner()
    this.emit('P1', { type: 'roundStart' })
    this.emit('P2', { type: 'roundStart' })
  }

  emit(id: FighterId, e: SdkEvent): void {
    this.eventQueue[id].push(e)
  }

  drainEvents(id: FighterId): SdkEvent[] {
    const out = this.eventQueue[id]
    this.eventQueue[id] = []
    return out
  }

  step(dt: number): void {
    this.now += dt
    if (!this.roundOver && this.running)
      this.roundTime -= dt
    const p1 = this.physics.p1; const p2 = this.physics.p2

    // 硬直恢复
    for (const [id, f] of [['P1', p1], ['P2', p2]] as const) {
      if (f.state === 'stun' && this.now >= this.stunUntil[id]) {
        f.state = 'normal'
        this.emit(id, { type: 'stateChange', state: 'normal' })
      }
    }

    this.processDamage()

    // 倒地事件
    for (const [id, f] of [['P1', p1], ['P2', p2]] as const) {
      if (f.state === 'down' && !this.lastDown[id])
        this.emit(id, { type: 'stateChange', state: 'down' })
      this.lastDown[id] = f.state === 'down'
    }

    // 胜负
    if (!this.roundOver && this.running && (p1.hp <= 0 || p2.hp <= 0 || this.roundTime <= 0)) {
      this.roundOver = true
      this.running = false
      if (p1.hp <= 0 && p2.hp <= 0)
        this.winner = 'draw'
      else if (p2.hp <= 0)
        this.winner = 'P1'
      else if (p1.hp <= 0)
        this.winner = 'P2'
      else this.winner = p1.hp === p2.hp ? 'draw' : (p1.hp > p2.hp ? 'P1' : 'P2')
      for (const f of [p1, p2]) {
        if (f.hp <= 0 && f.state !== 'ko') {
          f.state = 'ko'
          f.clearMotors()
        }
      }
      this.hud.banner(
        this.winner === 'draw' ? '平 局' : `${this.winner} 获胜！`,
        '按 ESC 打开菜单重新开始',
      )
      this.emit('P1', { type: 'roundEnd', winner: this.winner })
      this.emit('P2', { type: 'roundEnd', winner: this.winner })
    }

    // 受击闪红恢复
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const fl = this.flashes[i]
      if (this.now >= fl.until) {
        this.views[fl.fighter].setPartColor(fl.part, fl.colorBefore)
        this.flashes.splice(i, 1)
      }
    }
  }

  private processDamage(): void {
    this.physics.eventQueue.drainContactForceEvents((contact) => {
      const a = this.physics.colliderMap.get(contact.collider1())
      const b = this.physics.colliderMap.get(contact.collider2())
      if (!a || !b)
        return
      if (a.kind === 'static' || b.kind === 'static')
        return
      if (a.fighter === b.fighter || !a.fighter || !b.fighter)
        return
      const force = contact.totalForceMagnitude()
      this.diag.pairs++
      this.diag.maxForce = Math.max(this.diag.maxForce, Math.round(force))
      if (this.diag.hits.length < 40 && this.diag.pairs % 20 === 0) {
        this.diag.hits.push(`${a.part}↔${b.part} F=${Math.round(force)}`)
      }
      // 饱和基：轻蹭小、重拳饱和，避免高冲击 × 倍率线性爆炸。
      const over = force - CFG.dmgThreshold
      if (over <= 0)
        return
      const dmgBase = (CFG.dmgBaseMax * over) / (over + CFG.dmgHalfScale)

      // 部位三分类：只有攻击部位（双手双脚）能造成伤害。
      // 双方都不是攻击部位（躯干互撞/头槌），或双方都是攻击部位（手脚互磕）→ 不结算。
      const aAtk = PARTS[a.part!].role === 'attack'
      const bAtk = PARTS[b.part!].role === 'attack'
      if (aAtk === bAtk)
        return
      const attacker = aAtk ? a : b
      const victim = aAtk ? b : a
      const victimPart = victim.part!
      const attackerPart = attacker.part!

      // 冷却：同一攻击部件对同一角色 0.45s 一次（仅正式结算时消耗，
      // 慢速推挤 / KO 不占冷却，避免"先蹭一下吃掉真拳"）
      const key = `${attacker.fighter!.id}:${attackerPart}:${victim.fighter!.id}`
      if ((this.hitCooldown.get(key) ?? 0) > this.now)
        return
      // 受击者无敌帧：任何有效命中后短时间内不再受伤，防多肢同帧叠伤秒杀
      const attackerF = attacker.fighter!; const victimF = victim.fighter!
      if (victimF.state === 'ko')
        return
      if (this.victimCooldown[victimF.id] > this.now)
        return
      // 慢速推挤不结算：攻击与受击部件相对速度太低 → 只是倚靠/站位接触
      const relV = this.relativePartSpeed(attackerF, attackerPart, victimF, victimPart)
      if (relV < CFG.dmgMinSpeed)
        return
      const speedMult = clamp(relV / CFG.dmgSpeedRef, CFG.dmgSpeedMin, CFG.dmgSpeedMax)
      const guardMult = this.guardFactor(victimF)
      // 受伤倍率：防御部位 0.1，受击部位按 头 > 身体 > 屁股 > 大腿
      const victimMult = PARTS[victimPart].hurtMult
      const guarded = PARTS[victimPart].role === 'defense' || guardMult < 1
      const dmg = guarded
        // 格挡/防御：可被完全挡下（0 伤 → 仍播格挡特效，见下方）
        ? Math.round(dmgBase * PARTS[attackerPart].strikeMult * victimMult * speedMult * guardMult)
        : clamp(Math.round(dmgBase * PARTS[attackerPart].strikeMult * victimMult * speedMult * guardMult), 1, CFG.dmgCap)
      this.hitCooldown.set(key, this.now + CFG.dmgCooldown)
      const cleanHit = dmg > 0
      if (cleanHit) {
        victimF.hp = Math.max(0, victimF.hp - dmg)
        this.victimCooldown[victimF.id] = this.now + CFG.dmgVictimCooldown
      }

      // 击退（与伤害挂钩并封顶；被完全挡下时只剩轻微推感）
      const dirX = Math.sign(victimF.partCenter('hip').x - attackerF.partCenter('hip').x) || 1
      const impulse = Math.min(CFG.knockCap, dmg * CFG.knockPerDmg)
      for (const bone of ['hip', 'torso'] as const) {
        victimF.parts[bone].body.applyImpulse({ x: dirX * impulse * 0.5, y: impulse * 0.12 }, true)
      }

      // 硬直（按伤害换算：轻蹭短、重拳长，封顶 0.35s；完全挡下不断招）
      const stunTime = Math.min(CFG.hitstunTime, CFG.hitstunBase + dmg * CFG.hitstunPerDmg)
      if (cleanHit && (victimF.state === 'normal' || victimF.state === 'down')) {
        victimF.state = 'stun'
        this.stunUntil[victimF.id] = this.now + stunTime
        this.emit(victimF.id, { type: 'stateChange', state: 'stun' })
      }

      // 特效：火花 + 飘伤害数字 + 部件闪光，按命中类型着色
      // （防御部位/抬臂格挡 = 蓝，头 = 红，其余受击部位 = 黄；
      //  0 伤的完全格挡飘"挡"字，不飘 0）
      const blocked = PARTS[victimPart].role === 'defense' || guardMult < 1
      const crit = victimMult >= 1.5
      const fxColor = blocked ? 0x8FD0FF : crit ? 0xFF5D4D : 0xFFD34D
      const [cx, cy] = victimF.partPivot(victimPart)
      this.app.spawnHitSpark(cx, cy, fxColor)
      this.app.spawnDamageText(cx, cy, cleanHit ? dmg : '挡', fxColor, crit)
      const before = this.views[victimF.id].currentTint(victimPart)
      this.views[victimF.id].setPartColor(victimPart, blocked ? 0x8FD0FF : 0xFF6B6B)
      this.flashes.push({ fighter: victimF.id, part: victimPart, until: this.now + 0.13, colorBefore: before })

      this.emit(victimF.id, { type: 'hit', damage: dmg, from: attackerF.id, dir: dirX })
      this.emit(attackerF.id, { type: 'dealHit', damage: dmg, to: victimF.id })
    })
  }

  /** 抬臂格挡判定：双前臂轴接近竖直向上且手腕高于髋部 → 伤害 ×guardMult */
  private guardFactor(f: FighterBody): number {
    const hipY = f.partCenter('hip').y
    let raised = 0
    for (const S of ['R', 'L'] as const) {
      const rot = f.parts[`forearm_${S}`].body.rotation()
      const ang = (((rot * 180) / Math.PI) % 360 + 360) % 360
      const upright = Math.abs(ang - 90) // 前臂轴接近竖直向上(≈90°)的偏差
      const wristY = f.partCenter(`hand_${S}`).y
      if (upright < 60 && wristY > hipY + 10)
        raised++
    }
    return raised === 2 ? CFG.guardMult : 1
  }

  /** 攻击/受击部件的相对速度（px/s）：慢速推挤过滤用 */
  private relativePartSpeed(aF: FighterBody, aPart: string, bF: FighterBody, bPart: string): number {
    const va = aF.partVelocity(aPart)
    const vb = bF.partVelocity(bPart)
    return Math.hypot(va.x - vb.x, va.y - vb.y)
  }
}
