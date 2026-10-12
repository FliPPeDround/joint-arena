// @ts-expect-error — vendored untyped legacy JS bundle (DragonBones 5.7 runtime + Pixi adapter)
import DBRaw from './dragonBones.esm.js';
import type { DBModule } from '../types/dragonBonesApi';

/** DragonBones 运行时（类型化门面）。使用前需设置 globalThis.PIXI（见 main.ts）。 */
const DB = DBRaw as unknown as DBModule;
export default DB;
export { DB };
