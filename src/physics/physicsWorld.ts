import RAPIER from '@dimforge/rapier2d-compat'
import { CFG } from '../config'
import { FighterBody, GROUP_STATIC } from './fighterBody'

export interface ColliderInfo {
  kind: 'p1' | 'p2' | 'static'
  fighter?: FighterBody
  part?: string
  staticName?: string
}

/**
 * 物理子步数：每逻辑帧（1/60s）跑 4 个 240Hz 物理子步。
 * 玩家马达是显式 PD（preStep 里算好力矩再 step），60Hz 下稳定界
 * （刚度 ω·dt < 2、阻尼 2·wn·dt < 2）把关节刚度压到撑不住平衡扭矩，
 * 角色会缓慢倾倒。240Hz 子步把稳定界放宽 4 倍，站立 / 行走才成立。
 */
const PHYS_SUBSTEPS = 4

/** 物理世界：静态场景 + 两个 FighterBody + 碰撞事件队列 */
export class PhysicsWorld {
  world: RAPIER.World
  eventQueue: RAPIER.EventQueue
  colliderMap = new Map<number, ColliderInfo>()
  p1: FighterBody
  p2: FighterBody

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: CFG.gravityY })
    this.world.timestep = CFG.fixedDt / PHYS_SUBSTEPS
    this.eventQueue = new RAPIER.EventQueue(true)

    // 地面
    const ground = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(CFG.arenaHalfWidth + CFG.groundExtend, 30)
        .setTranslation(0, -30)
        .setCollisionGroups(GROUP_STATIC)
        .setFriction(0.95),
    )
    this.colliderMap.set(ground.handle, { kind: 'static', staticName: 'ground' })

    // 左右墙
    for (const sx of [-1, 1] as const) {
      const wall = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(30, CFG.wallHeight)
          .setTranslation(sx * (CFG.arenaHalfWidth + 30), CFG.wallHeight)
          .setCollisionGroups(GROUP_STATIC)
          .setFriction(0.2),
      )
      this.colliderMap.set(wall.handle, { kind: 'static', staticName: sx < 0 ? 'wall_L' : 'wall_R' })
    }

    // 软天花板（防止击飞出场）
    const ceiling = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(CFG.arenaHalfWidth + CFG.groundExtend, 20)
        .setTranslation(0, CFG.ceilingY)
        .setCollisionGroups(GROUP_STATIC),
    )
    this.colliderMap.set(ceiling.handle, { kind: 'static', staticName: 'ceiling' })

    this.p1 = new FighterBody(this.world, 'P1', 1, -CFG.spawnX)
    this.p2 = new FighterBody(this.world, 'P2', 2, CFG.spawnX)
    for (const f of [this.p1, this.p2]) {
      for (const [bone, ref] of Object.entries(f.parts)) {
        this.colliderMap.set(ref.collider.handle, {
          kind: f.id === 'P1' ? 'p1' : 'p2',
          fighter: f,
          part: bone,
        })
      }
    }
  }

  step(): void {
    // 记录步前位姿，供渲染层在固定步之间插值
    this.p1.capturePrev()
    this.p2.capturePrev()
    // 子步：马达 / 平衡 / 根部控制都是 ×dt 的连续力，按子步施力等价且更稳
    const dtSub = CFG.fixedDt / PHYS_SUBSTEPS
    for (let i = 0; i < PHYS_SUBSTEPS; i++) {
      this.p1.preStep(dtSub)
      this.p2.preStep(dtSub)
      this.world.step(this.eventQueue)
    }
    this.p1.postStep(CFG.fixedDt)
    this.p2.postStep(CFG.fixedDt)
    this.p1.clearFrameCommands()
    this.p2.clearFrameCommands()
  }

  /** 某部件当前接触到的对象名列表 */
  contactsOf(fighter: FighterBody, bone: string): string[] {
    const ref = fighter.parts[bone]
    if (!ref)
      return []
    const out: string[] = []
    this.world.contactPairsWith(ref.collider, (other: RAPIER.Collider) => {
      const info = this.colliderMap.get(other.handle)
      if (!info)
        return
      if (info.kind === 'static')
        out.push(info.staticName!)
      else out.push(`${info.fighter!.id}:${info.part}`)
    })
    return out
  }

  destroyFighters(): void {
    this.p1.destroy()
    this.p2.destroy()
  }
}
