# 实施计划：前端构建分块、内外细节统一与工作台输入无障碍优化

## 最终收口

- [x] 按用户最终视觉确认统一为 8px 卡片/弹窗、6px 控件、浅灰蓝侧栏与纯色画布；不回退旧直角基线。
- [x] 复查补齐缩略图双按钮 44px 热区、排序/空分类切换后的输入草稿恢复；先复现失败再修复。
- [x] 独立 `trellis-check` 一次终审，无阻塞问题。
- [x] 最终新鲜构建、工作台 84 组、列表 43 组、系统组 32 组（含连续业务路径）、图片/拖拽/LAN/PWA 回归通过，实际查看双端截图。
- [x] 完整证据及构建信息见 `verification-final.md`，早期数据不作为最终产物数字。

## 检查清单

### Phase 1: Vite 打包优化
- [x] 修改 `vite.config.ts`，在 `manualChunks` 中增加 `jszip` 与 `qrcode`。
- [x] 运行 `npm run build`，确认主 chunk 体积小于 500KB，无构建警告，Service Worker 正常生成。

### Phase 2: 工作台输入框组件隔离
- [x] 在 `src/components/ContentArea.tsx` 中抽取 `AddItemBar` 组件。
- [x] 将 `newItemLabel` 状态与重置逻辑移至 `AddItemBar` 内部。
- [x] `ContentArea` 使用 `useCallback` 传递 `handleAddItem`。

### Phase 3: 内外视觉统一与巡检进度反馈
- [x] 统一 `ProjectListHeader.tsx` 顶栏按钮样式、`type="button"` 与品牌名称（「证据采集平台」）。
- [x] 统一 `Sidebar.tsx` 顶部名称与未完成必填项的具体数量悬停提示。
- [x] 在 `ContentArea.tsx` 资产信息行内补充实时「待补 N 项必填 / 必填已齐」指示。

### Phase 4: 无障碍与触控热区补齐
- [x] 在 `src/components/ItemCard.tsx` 中优化重命名与删除按钮的触控热区至 44×44px（`min-h-11 min-w-11`）。
- [x] 在 `src/components/UploadZone.tsx` 中增加 `onKeyDown` 键盘 Enter/Space 处理与 `role="button"`。
- [x] 在 `src/components/ImageThumbnail.tsx` 中补齐 `group-focus-within:opacity-100`、`type="button"` 与中文 `aria-label`。
- [x] 在 `src/components/Toolbar.tsx` 与 `Sidebar.tsx` 补齐显式 `type="button"`。

### Phase 5: 全套回归与验证

### 追加：分类菜单白屏修复
- [x] 新增真实分类切换用例，修复前生产包复现 React #300。
- [x] 将 `handleAddItem` Hook 移至空状态提前返回之前，不改变当前视觉。
- [x] 新鲜构建后双端 1440px、375px 分类往返通过，完整工作台 80 个报告组通过，PWA 检查通过。
- [x] 实测启动器调用的本地服务器，返回 JS 与 `dist` SHA-256 相同；临时服务器已停止。
- [x] 更新发布说明、CHANGES 与 Hook 规范；详细证据见 `verification-white-screen.md`。

### 原优化回归
- [x] 运行 `npm run build`。
- [x] 运行 `node scripts/verify-inspection-item-interactions.mjs`。
- [x] 运行 `node scripts/verify-inspection-item-pointer-drag.mjs`。
- [x] 运行 `node scripts/verify-project-list-views.mjs`。
- [x] 运行 `node scripts/verify-image-viewer.mjs`。
- [x] 运行 `npm run verify:pwa-build`。
- [x] 运行 `node scripts/verify-project-list-ui.mjs` 与 `node scripts/verify-project-list-ui.mjs --workspace`。
