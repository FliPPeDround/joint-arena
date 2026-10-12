/** DragonBones 运行时本项目用到的 API 表面（类型门面） */
export interface DBMatrix {
  a: number
  b: number
  c: number
  d: number
  tx: number
  ty: number
}
export interface DBTransform {
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
  skewX: number
  skewY: number
}
export interface DBBone {
  readonly name: string
  /** Offset transform applied on top of origin — the physics sync writes here. */
  offset: DBTransform
  readonly global: DBTransform
  readonly globalTransformMatrix: DBMatrix
}
export interface DBSlot {
  readonly name: string
  /** Current render display object (a PIXI.Sprite for image displays). */
  display: unknown
}
export interface DBArmature {
  readonly name: string
  getBone: (name: string) => DBBone | null
  getSlot: (name: string) => DBSlot | null
  getBones: () => DBBone[]
  getSlots: () => DBSlot[]
  advanceTime: (passedTime: number) => void
  invalidUpdate: () => void
}
export interface DBArmatureDisplay {
  armature: DBArmature
  x: number
  y: number
  scaleX: number
  scaleY: number
  scale: { x: number, y: number, set: (x?: number, y?: number) => void }
  position: { set: (x?: number, y?: number) => void }
  destroy: (options?: { children?: boolean, texture?: boolean, baseTexture?: boolean }) => void
}
export interface DBFactory {
  clock: {
    add: (armature: unknown) => void
    remove: (armature: unknown) => void
    advanceTime: (t: number) => void
  }
  parseDragonBonesData: (raw: object, name?: string) => unknown
  parseTextureAtlasData: (raw: object, texture: unknown, name?: string) => unknown
  /** 构建骨架并返回 Pixi 显示对象（PixiArmatureDisplay，即 PIXI.Container 子类） */
  buildArmatureDisplay: (armatureName: string, dragonBonesName?: string, skinName?: string, textureAtlasName?: string) => DBArmatureDisplay | null
}
export interface DBModule {
  PixiFactory: { new (): DBFactory }
}
