import { createRouter, createWebHistory } from 'vue-router'
import { getPreset } from '../stores/presets'
import BattleView from '../views/BattleView.vue'
import EditorView from '../views/EditorView.vue'
import LobbyView from '../views/LobbyView.vue'

/**
 * 顶层场景路由（游戏语义：路由即场景，不是「页面」）。
 * 大厅 / 编辑 / 对战共享同一个常驻舞台（GameStage），路由只切换叠加在
 * 世界之上的交互层与引擎玩法模式，切换时不卸载画布、不重建引擎。
 */
/**
 * 路由基址跟随构建基址：GitHub Pages 部署在 /<repo>/ 子路径下时，
 * 必须是绝对前缀，否则深链（/joint-arena/editor/xxx）会被解析到错误位置。
 * 本地构建的基址是相对值 './'，此时按站点根路径处理。
 */
const baseURL = import.meta.env.BASE_URL
const historyBase = baseURL.startsWith('/') ? baseURL : '/'

export const router = createRouter({
  history: createWebHistory(historyBase),
  routes: [
    { path: '/', name: 'lobby', component: LobbyView },
    {
      path: '/editor/:presetId',
      name: 'editor',
      component: EditorView,
      // 深链到不存在的预设（如清了 localStorage）时回大厅，编辑页自身不处理空预设
      beforeEnter: (to) => {
        return getPreset(String(to.params.presetId)) ? true : { name: 'lobby' }
      },
    },
    // :presetId 可选 —— 训练模式带预设进入；M0 渲染管线演示等直连场景不带
    { path: '/battle/:presetId?', name: 'battle', component: BattleView },
  ],
})

// M0 渲染管线演示模式：任何带 ?mode=m0 的 URL 一律落到对战页（引擎内按 M0 分支驱动）
router.beforeEach((to) => {
  if (to.query.mode === 'm0' && to.name !== 'battle')
    return { name: 'battle', query: to.query }
})
