# 分类菜单白屏修复验证

## 根因与修改范围

`ContentArea.tsx` 抽取 `AddItemBar` 后，`handleAddItem = useCallback(...)` 放在空资产状态提前返回之后。`SET_ACTIVE_CATEGORY` 选择空分类时清空当前资产，导致渲染跳过此 Hook，生产 React 抛出 #300（Rendered fewer hooks than expected）并卸载页面。

本次只将该 Hook 移到提前返回之前，保留当前 Gemini 的视觉调整；没有修改数据库、分类动作协议或资产保存方式。工作区另有用户既存的前端修改，本记录不将它们视为本次白屏修复内容。

## RED

- 新增 `categoryNavigation()` 浏览器用例与 `--workspace --navigation-only` 聚焦入口。
- `node scripts/verify-project-list-ui.mjs --workspace --web-only --navigation-only`：修复前退出码 1，捕获 `Minified React error #300`；页面正文为空。
- React 本地开发源码 `node_modules/react-dom/cjs/react-dom.development.js` 确认对应异常为 Hook 数量减少与提前返回。

## GREEN

- `npm run build`：通过，主包 `index-DXI_DADv.js` 494729 字节，Service Worker 缓存版本 `a2263bd54103`，14 个预缓存资源，无 chunk 超限警告。
- `node scripts/verify-project-list-ui.mjs --workspace --navigation-only`：Web/Electron × 1440/375px，4 个报告组通过。每组遍历 8 个分类两轮，验证空分类引导、原资产恢复、无检查项资产、无运行时错误与原图字节。
- `node scripts/verify-project-list-ui.mjs --workspace`：80 个报告组通过，包括上述路径、320/375/768/1024/1440px 布局、模态/焦点/草稿生命周期、检查项实际落库和真实 DOCX 图片导出。
- `npm run verify:pwa-build`：通过。
- `git diff --check`：通过；RELEASE-NOTES.md 的 LF/CRLF 提醒不是校验失败。
- 已人工查看 `.trellis/.runtime/workspace-qa/web-category-navigation-1440.png` 与 `desktop-category-navigation-375.png`，正文、原图、导航和工具栏可见。
- 双端完整报告：`.trellis/.runtime/workspace-qa/results.json`。

## 启动入口

首次探测固定端口 51730 无运行中的服务。随后临时运行与 `.bat` 相同的 `start-server.ps1 -NoBrowser`，从 `http://127.0.0.1:51730/` 请求 HTML 与入口 JS；入口 SHA-256 与本地 `dist` 相同：

`b6e3fbdf7134dd455d116c79c36cac137ee963706335afab25bf32e734c47128`

临时服务在 finally 中结束。没有更换浏览器来源或读写用户项目库；验证浏览器使用隔离测试数据。`.bat` 原有源码指纹机制仍会在下次启动时自动检测更新；未手工伪造其构建缓存，也未重新打包安装版。

## 自查

全部 ContentArea Hook 均位于空状态返回之前；回调继续通过实时 ref 选择目标资产，空值直接返回。分类往返覆盖进入和离开空状态两方向。测试结束恢复核心交换机，以免污染后续套件前提；事件监听在 finally 清理。当前视觉代码与用户修改保持原状。
