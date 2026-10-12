import { DB_PARENT, PART_LIST } from './partDefs'

/**
 * 手工构建 DragonBones 骨架数据（v5.5 格式 JSON）。
 * 所有骨骼 origin 为单位变换 — 真实姿态由物理同步层写入 bone.offset，
 * 或由 M0 演示驱动器写入。贴图 pivot 由图集 JSON 提供。
 */
export function buildSkeletonJSON(name: string): object {
  const bones: object[] = [
    { name: 'root', parent: null, length: 0, transform: { x: 0, y: 0, rotation: 0, scX: 1, scY: 1 } },
  ]
  for (const p of PART_LIST) {
    bones.push({
      name: p.bone,
      parent: DB_PARENT[p.bone],
      length: p.L,
      transform: { x: 0, y: 0, rotation: 0, scX: 1, scY: 1 },
    })
  }

  const slots = PART_LIST.map(p => ({
    name: p.slot,
    parent: p.bone,
    displayIndex: 0,
    z: p.z,
    blendMode: 'normal',
  }))

  const skinSlots = PART_LIST.map(p => ({
    name: p.slot,
    display: [{ type: 'image', name: p.bone, transform: { x: 0, y: 0, rotation: 0, scX: 1, scY: 1 } }],
  }))

  return {
    version: '5.5',
    name,
    frameRate: 60,
    isGlobal: 0,
    armature: [
      {
        name,
        frameRate: 60,
        type: 'Armature',
        bone: bones,
        slot: slots,
        skin: [{ name: 'default', slot: skinSlots }],
        ik: [],
        animation: [],
        defaultActions: [],
      },
    ],
  }
}
