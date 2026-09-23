# Web 样式约束

- `src/styles/theme.ts` 是 Web 视觉 token 的唯一主题来源，负责 Ant Design、CSS 语义变量和图表主题所需的视觉值。
- `src/styles/global.less` 只允许包含 Tailwind 指令、根变量、reset、字体和 `html/body/button` 根节点规则，不得写菜单栏、页面布局或组件选择器。
- 工作台布局、菜单栏、内容区和共享页面布局必须跟随所属组件，统一放在 `AppShell.less` 或明确命名的共享组件样式文件中。
- 页面和组件样式必须放在所属页面或组件目录中，禁止将多个页面组件样式集中到同一个全局样式文件。
- 颜色、文字颜色、字号、背景、边框、圆角、阴影等静态视觉属性必须使用 Ant token 或语义 CSS 变量；动态尺寸可以由运行时数据决定。
- ECharts 必须通过统一主题 hook 获取颜色，不得在页面图表配置中维护另一套浅色/深色色值。
- 修改主题后必须执行 `pnpm lint` 和 `pnpm build`。
