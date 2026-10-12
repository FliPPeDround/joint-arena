import antfu from '@antfu/eslint-config'

export default antfu({
  type: 'app',
  pnpm: true,
  antislop: true,
  vue: true,
  unocss: true,
  ignores: [
    'dist',
    // vendored 的 DragonBones 5.7 补丁版运行时，不参与 lint
    'src/vendor',
    // 文档里的示例代码块非可运行源码
    'docs',
    // 样式与页面入口，不按 JS 解析
    '**/*.css',
    '**/*.html',
  ],
}, {
  rules: {
    // 引擎代码是紧凑的数学/物理风格，一行多条短语句是既有约定
    'style/max-statements-per-line': ['error', { max: 4 }],
    // 游戏算法（raycast / 战斗判定 / 物理平衡）的复杂度是本质复杂度
    'sonarjs/cognitive-complexity': 'off',
    // workerSdk 的 raycast 用 outer 标签做步进命中的提前退出
    'no-labels': 'off',
    // 引擎与 vendored DragonBones / Pixi v4 shim 的边界需要跨类型断言
    'slop/no-chained-type-assertions': 'off',
  },
}, {
  // 中文项目：「——」是规范的中文标点；该规则面向英文 AI slop，对中文文案全是误报
  files: ['**/*.md', '**/*.vue', '**/*.{ts,js,json,yaml}'],
  rules: {
    'slop/no-em-dash': 'off',
  },
})
