# 前端构建分块、内外细节统一与工作台输入无障碍优化

## Goal

按用户最终确认的浅灰蓝导航、纯色画布与统一圆角功能型界面，对前端“外面”（项目管理中心）与“里面”（证据采集工作台）进行性能、视觉统一性与无障碍优化：
1. 优化 Vite 打包分块（`manualChunks`），将 `jszip`、`qrcode` 独立分块，消除主包体积 >500KB 警告（保留静态加载）；
2. 隔离 `ContentArea` 中的“添加检查项”输入框状态，抽取独立 `AddItemBar` 子组件，阻断敲字时数十个检查项卡片的全量重复渲染；
3. 统一“外面”顶栏按钮边角、字重与产品品牌名称，并在“里面”工作台行内补充直观的必填待补计数（`待补 N 项必填` / `必填已齐`）；
4. 补齐 `ItemCard`、`UploadZone`、`ImageThumbnail`、`Toolbar`、`Sidebar`、`ProjectListHeader` 的 44×44px 触控热区、键盘聚焦可见性、`type="button"` 与中文 `aria-label`。

## Requirements

### 1. 打包分块与体积优化 (Bundle Splitting)
- 在 `vite.config.ts` 的 `rollupOptions.output.manualChunks` 中将 `jszip` 与 `qrcode` 独立分块。
- 执行 `npm run build` 后主包 `dist/assets/index-*.js` 降至 500KB 以下，消除 chunk 超限警告。

### 2. 工作台输入状态隔离 (Render Optimization)
- 将 `ContentArea.tsx` 顶层的 `newItemLabel` 及其输入交互提取为独立的 `AddItemBar` 子组件。
- 敲击键盘更新输入文字时仅触发该子组件内部渲染，不触发父级 `ContentArea` 及其所有子 `ItemCard` 的 re-render。

### 3. 内外视觉统一与巡检进度反馈 (Outer/Inner Polish)
- 卡片/普通弹窗 8px、按钮/输入框 6px；纯色画布、浅灰蓝导航与白色内容保持层次，去掉点阵与重复标签，不添加装饰框。
- 统一 `ProjectListHeader` 顶栏按钮样式与搜索框圆角，统一外层顶栏与内层侧栏的平台名称为「证据采集平台」。
- 在工作台资产标题下方显示总检查项与必填进度条（完成数/必填数、待补数或已齐）；侧栏红点提示具体未上传必填项数。

### 4. 无障碍交互与热区补齐 (Accessibility & Touch Targets)
- `ItemCard` 重命名和删除按钮提供 `min-h-11 min-w-11`（44×44px）可点击热区与聚焦环。
- `UploadZone` 补齐 `role="button"`、`aria-label` 与键盘 `Enter` / `Space` 唤起文件选择器。
- `ImageThumbnail` 悬停遮罩补齐 `group-focus-within:opacity-100`、按钮 `type="button"` 与中文 `aria-label`。

## Acceptance Criteria

### 追加：分类菜单白屏回归

- [x] 新增检查项草稿跨排序模式和空分类切换后保留，提交后清空；缩略图双按钮均达 44px 且键盘聚焦可见。
- [x] 有资产分类与空分类反复切换时，工作区、导航和工具栏保持可用，无 React Hook 次序异常。
- [x] 切回有资产分类或无检查项资产均正常显示；原检查项、图片和备注不变。
- [x] Web 与桌面端在 1440px、375px 均验证上述路径，保留当前视觉样式。

### 前期优化验收

- [x] `npm run build` 成功，主 bundle 体积低于 500KB，无 `(!) Some chunks are larger than 500 kB` 警告。
- [x] `AddItemBar` 状态完全内聚，输入过程中 `ContentArea` 与 `ItemCard` 不发生重复渲染。
- [x] 内外顶栏按钮边角、品牌名称统一，工作台实时展示「待补 N 项必填 / 必填已齐」。
- [x] `ItemCard`、`UploadZone`、`ImageThumbnail` 满足 44px 热区、键盘触发与中文可访问名称规范。
- [x] 所有既有前端回归脚本（含 `verify-project-list-ui.mjs` 列表与 `--workspace` 双端全断点回归、`verify-image-viewer.mjs` 等）100% 通过。
