# 组件规范

> 组件以函数组件实现，Props 使用同文件接口显式描述；样式主要直接通过 Tailwind utility class 编写。

## 组件形态与 Props

- 使用具名 Props 接口和 `React.FC<Props>`。例如 `src/components/project-list/ProjectTableRow.tsx` 的 `ProjectTableRowProps`，以及 `src/components/ConfirmDialog.tsx` 的 `ConfirmDialogProps`。
- 回调 Props 表示用户意图并由父层完成状态更新或副作用，例如 `onOpen`、`onDelete`、`onConfirm`，不要把父级状态写入细节隐藏在展示组件中。
- 复杂页面可以保留局部 UI 状态；需要跨工作台共享或持久化的项目数据通过 `useAppState()`、`useDispatch()`、`useAppContext()` 获取，参见 `src/components/ContentArea.tsx` 和 `src/App.tsx`。
- 对仅由当前模块使用的辅助行组件可与父组件同文件定义；`src/components/TemplateDialog.tsx` 中的 `TemplateItemRow` 是现有示例。可独立使用的项目列表单元则拆到 `components/project-list/`。

## 文件内组织

通常按以下顺序：React/类型/本地模块导入、Props 或本地类型、组件及其 handlers、JSX、默认导出。需要性能稳定引用或 effect 依赖时使用 `useCallback`/`useMemo`，如 `src/App.tsx` 的 LAN 快照和导出 handlers；不要为简单 JSX 常量机械包裹 memo。

## 样式

- 直接在 `className` 使用 Tailwind 类，沿用现有的 slate/blue/red 色彩、边框、直角卡片和响应式断点写法。`src/components/project-list/ProjectTableRow.tsx` 和 `src/components/LanMobileCollector.tsx` 是代表例子。
- 全局基础字体与 `.text-sm`/`.text-xs` 文字大小覆写只位于 `src/index.css`；除非确属全局基础规则，不要新增组件专属全局 CSS。
- 重复的项目列表网格类抽到 `src/components/project-list/projectListUi.ts`，而不是复制到表头和表格行。实际列表共用 `SYSTEM_LIST_GRID` / `GROUP_SYSTEM_LIST_GRID`；窄屏操作可换到下一行，名称不得被固定操作列挤出窗口。
- 多系统项目在当前页原地展开：项目名称和箭头为同一原生按钮，`aria-expanded`/`aria-controls` 关联组内区域；项目工具放在按钮外。支持同时展开多个组，独立项目容器以浅色标题栏区分；展开区域至少 44×44px，SVG 箭头 20px，标题区域可点击。项目单位/系统数/更新时间集中在标题栏，下方系统表格使用自己的表头与网格；相同单位不重复，不同单位在系统名下保留。全选并入表头，仅选择后显示批量删除；资产数有独立表头且不换行。收起包含当前焦点的组时，焦点返回项目按钮。页签下同名分类标题只保留 sr-only 语义，不占可见空间。
- 项目列表低频操作在所有宽度都通过 `ProjectActions` 的原生 `details/summary` 收纳：共用 name 保持单展开，普通按钮用 Tab 导航，不冒充 ARIA menu；Escape 关闭并聚焦 summary，操作后关闭，焦点离开/外部点击关闭。菜单初始样式即为 `position: fixed; visibility: hidden`，避免首次展开占据文档空间导致锚点偏移，再按窗口剩余空间上下展开，窗口滚动/缩放时关闭；只有展开时注册全局监听，卸载时清理。

## 普通弹窗样式

- `src/components/dialogStyles.ts` 集中定义普通弹窗外框、标题、正文、底栏、输入框及按钮类。沿用工作台直角、slate 边框与蓝色主操作；宽度按内容保留，图片查看器与相机全屏布局不套用该样式。
- 底栏按次要操作在左、主操作在右排列，危险操作为红色。保留功能色：局域网浅蓝/采集中绿色、项目信息浅黄、覆盖导入橙色、合并导入与导入成功绿色、缺项提醒琥珀色/红色、模板必填红色。
- `TemplateDialog.tsx` 的行内编辑和删除按钮常显，采用原生按钮并提供中文可访问名称，键盘和触屏均可操作，不依赖 hover 才能出现。

## 可访问性与交互

- 对话框容器使用 `role="dialog"` 和 `aria-modal="true"`；有可见标题时以 `aria-labelledby` 关联它，参见 `src/components/LanCollectorDialog.tsx`。无独立标题的图片预览 `src/components/ImageViewer.tsx` 目前只有 `role`/`aria-modal`，新增或重构时不要将其误作完整命名范例。
- 状态通知使用 `role="status"` 或 `aria-live`，见 `LanCollectorDialog.tsx` 和 `PwaReadinessCard.tsx`。
- 非阻塞轻提示统一走 `useToast()`（`src/components/Toast.tsx` 的 `ToastProvider` 挂在 `main.tsx`），成功/失败/信息分别用 `success`/`error`/`info`；error toast 用 `role="alert"`，其余用 `role="status"`。不要用 `window.alert` 做提示；二次确认仍用 `useConfirmDialog()`。
- 新增仅有图标或关闭符号的按钮必须有中文 `aria-label`，输入错误状态通过 `aria-invalid` 暴露，见 `src/components/project-list/NewProjectDialog.tsx`。历史 `ImageViewer.tsx` 的图标按钮仅有 `title`，不应复制；应在后续触及该组件时补齐。
- 使用语义化 `button`、`label`、`input`；移动端及对话框中的按钮通常写明 `type="button"`，参见 `src/components/LanMobileCollector.tsx` 和 `LanCollectorDialog.tsx`。项目列表及早期组件存在省略该属性的历史写法；新增表单内按钮应显式写明，且保留禁用状态。

## 工作台窄屏布局与模态生命周期

### 1. 范围
仅 `#/project/:id` 工作台，由 `WorkspaceLayout` 装配 Sidebar/Toolbar/ContentArea。`#/mobile` 与 LAN 采集路由不改，数据与保存逻辑仍归 Context。

### 2. 接口
- `WorkspaceLayoutProps = { toolbar: Omit<ToolbarProps, 'onOpenNavigation' | 'navigationOpen'>; children: React.ReactNode }`。
- `SidebarProps` 可选 `compact: boolean`、`onClose: () => void`、`onSelectAsset: () => void`；Toolbar 可选 `onOpenNavigation` 与 `navigationOpen`，只表达瞬时 UI 意图。

### 3. 契约
- 1024px 为常驻/导航面板边界；全程只有一个 Sidebar 实例，窄屏不改 `sidebar-width`。面板打开时背景 inert，选择资产后聚焦正文，普通关闭恢复入口。
- 媒体查询和可见状态同批次更新；侧栏仍有编辑/确认焦点时，缩窄保留面板与焦点，扩大不强制聚焦正文。不能先用 CSS 隐藏正在编辑的输入框，再依赖 effect 修复；浏览器会先触发 blur 并提交草稿。
- 工具栏整组换行，按钮不压缩/拆字；窄屏导航控件至少 44px，主内容 min-width/min-height 正确并自行纵向滚动，长名称折行；不靠全局裁切掩盖横向溢出。
- ConfirmDialog 独立初始聚焦取消、约束 Tab/focusin、处理 Escape 并恢复触发焦点；外层导航遇内层 dialog 不接管按键。内层跨断点不能依赖外层已被清理的焦点监听。确认框用 aria-labelledby 关联标题，消息使用 overflow-wrap:anywhere 处理无空格长名称；侧栏重命名 flex 输入显式 min-w-0，320px 下也应保留操作按钮。

### 4. 边界矩阵
空系统仍可打开导航；关闭/卸载解除 inert 和监听；跨断点保留新增/重命名草稿、不触发失焦提交；内层确认取消不关闭导航；ConfirmDialog 遮罩点击须 stopPropagation 后再取消，避免冒泡到 TemplateDialog 等外层遮罩而关闭两层。`--workspace` 在双端 375/1440px 覆盖遮罩、取消、Escape 和确认删除，验证外层窗口/草稿保留、取消不删条目且恢复触发焦点、确认只删除目标项；拖动调宽与键盘调宽仅宽屏可用。

### 5. 正常与异常例
375px 正文占满视口，导航展开可选原资产和图片；1440px 保持常驻与原宽度。重命名尚未确认时扩大窗口，输入仍在且库内名称不变；删除确认跨宽度仍只能在确认框内 Tab，取消后保留原资产。

### 6. 验证
`npm run build` 后 `node scripts/verify-project-list-ui.mjs --workspace`：原生隔离 Web/Electron，320/375/768/1024/1440px、有限高度、长名称、无横向溢出、真实 Enter/Space/双向 Tab/Escape/鼠标拖宽、跨断点两类草稿与确认、实际新增/落库、原图字节与 DOCX 下载。并跑分组/预设/列表/图片、检查项拖拽和 LAN 生命周期回归。

### 7. 反例
错误：复制两套 Sidebar 切换、全局 overflow-x-hidden、所有模态共用一个随导航销毁的焦点监听。正确：同一实例、真实几何约束、区分断点转换与关闭，内层模态独立管理焦点。

## 避免

- 不要将网络请求、IndexedDB 保存、导入导出协议直接揉进纯展示组件；应经 Context 或 `utils/` 边界调用。
- 不要用不可访问的普通 `div` 代替按钮/对话框，也不要遗漏加载、禁用或错误反馈。
- 不要在多个组件复制相同的布局常量或状态变更逻辑。
