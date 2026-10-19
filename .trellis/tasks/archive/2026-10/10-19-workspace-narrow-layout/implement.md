# 窄屏工作台实施计划

## 状态与顺序
R5 实现、一次 medium 独立只读审查、反馈修正和最终双端回归已完成；主会话直接实施，无额外实现代理。验收与日志见 verification.md。当前恢复父任务集中本地提交确认门槛，尚未提交/归档，不触碰另一桌面目录任务。

## TDD 清单
- [x] RED：隔离生产页面 375px 宽度/正文可用宽度、工具栏按钮整词与导航入口断言因实际挤压失败，保留截图和日志。
- [x] GREEN：局部 WorkspaceLayout、同一 Sidebar、工具栏换行和正文约束；不改持久化与原移动路由。
- [x] 验证原生 Enter/Space 打开及选择资产、Tab/Shift+Tab、Escape/遮罩、内层确认、focus/inert 恢复。
- [x] 验证草稿/桌面宽度跨断点保持、空和长标题、带图资产、实际新增资产/检查项及工具栏入口。
- [x] 逐项检查 320/375/768/1024/1440px 双端截图、主内容无横向溢出及有限高度操作；截图读取后释放上下文。
- [x] 跑受影响回归与原 R1–R4；真实失败先定位，不用删除断言或隐藏溢出来通过。
- [x] 更新父任务联合验收、README/CHANGES/规范/提交清单；独立检查按风险取适当推理强度，不重复全套运行。

## 命令
```bash
npm run build
node scripts/verify-project-list-ui.mjs --workspace
node scripts/verify-project-list-ui.mjs --system-groups
node scripts/verify-project-list-ui.mjs --presets
node scripts/verify-project-list-ui.mjs
node scripts/verify-project-list-ui.mjs --images
node scripts/verify-inspection-item-interactions.mjs
node scripts/verify-inspection-item-pointer-drag.mjs
node scripts/verify-lan-upload-ui.mjs --lifecycle
npm run verify:lan-mobile-picker
npm run verify:pending-writes
npm run verify:pwa-build
git diff --check
```
如实际差异涉及其他共用组件/交互，按证据补相应既有套件。所有验证只在合成隔离库，结束关闭临时浏览器/服务器；真实用户库、真实手机/系统相机及大库上限不在本地验证声明中。
