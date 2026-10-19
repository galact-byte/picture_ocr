# 窄屏工作台实施与验收记录

## 状态与边界
用户追加授权的 R5 已完成代码、本地构建、独立审查反馈修正及最终隔离双端回归。等待父任务提交方案的一次性确认，尚未提交/归档，不推送/发布，不触碰真实用户数据。保留原 workflow.md 本地修改。

## 实现与证据
- `<1024px` 用“分类导航”打开单一 Sidebar；选资产后回正文，普通关闭恢复入口焦点。宽屏保留常驻侧栏、鼠标拖动和键盘调宽。
- 工具栏整体换行、按钮不压缩拆字；正文独立滚动和长名称换行，不以全局横向裁切掩盖溢出。
- 跨断点同步保留新增/重命名草稿、当前资产和桌面宽度；不触发输入框失焦提交。导航背景 inert，内层确认独立处理初始焦点、正反 Tab、Escape 和恢复，跨宽度不会丢失约束。
- 确认框消息对无空格长英文采用 anywhere 折行，并通过 aria-labelledby 关联标题。重命名输入可收缩，确认框两按钮均在视口内。
- 375px 正文从原 136px 恢复到完整 375px；320/375/768/1024/1440px 在 Web/Electron 均完成页面、工具栏和主内容几何断言。覆盖有限高度、空系统、长中英文名称、真实新增资产/检查项、原图解码/字节与 DOCX 下载。

## RED 与独立审查
- 初始挤压 RED 与截图：`.trellis/.runtime/workspace-red.log` 和 workspace-qa/web-before.png。
- 跨断点草稿、确认焦点问题已定点复现并修正，聚焦记录见 workspace-green.log；最终结果以下方重新运行记录为准。
- 一次 medium 只读审查：`.trellis/.runtime/workspace-review.md`。长英文名称确认消息溢出、重命名输入缺乏确定性收缩及确认框命名三点均已处理；不重复委派全套审查。
- `workspace-long-confirm-red.log` 实际失败于“长英文资产名确认框内全部文本和按钮无横向溢出”。局部折行后，320/375px 双端实测通过，长名称重命名几何断言也通过。
- 额外测试确认：在“删除资产”按钮获得焦点后跨断点，焦点不回到取消，当前实现无需额外焦点修复。此前对话曾误报这一问题，已明确纠正。

## 最终命令与结果
构建：`.trellis/.runtime/workspace-final-build.log`；最终 11 条回归串行运行于 `.trellis/.runtime/workspace-final-regression.log`，全部 EXIT 0：

| 命令 | 实际结果 |
| --- | --- |
| npm run build | TypeScript、Vite、Service Worker 生成通过 |
| node scripts/verify-project-list-ui.mjs --workspace | Web 30 + Electron 30，共 60 个报告组 |
| node scripts/verify-project-list-ui.mjs --system-groups | 双端 32 个报告组，含同库引导→转组→导出链路 |
| node scripts/verify-project-list-ui.mjs --presets | 双端 52 个报告组 |
| node scripts/verify-project-list-ui.mjs | Web 22 + Electron 21，共 43 个报告组 |
| node scripts/verify-project-list-ui.mjs --images | 双端 4 个报告组 |
| node scripts/verify-inspection-item-interactions.mjs | 通过 |
| node scripts/verify-inspection-item-pointer-drag.mjs | 实际鼠标/触摸、取消和边缘滚动通过 |
| node scripts/verify-lan-upload-ui.mjs --lifecycle | 双端后台/恢复、会话范围和名称同步通过 |
| npm run verify:lan-mobile-picker | 通过 |
| npm run verify:pending-writes | 35/35 |
| npm run verify:pwa-build | 通过 |
| git diff --check | 通过 |

五类 UI 共 191 个报告组（不是 191 个独立测试），逐条 JSON 均无失败。此前原 R1–R4 数据/事务套件证据继续保存在父任务 verification.md，本项没有修改数据库或保存协议。

## 追加确认框点击隔离修复
后续复查发现模板删除确认的遮罩点击冒泡至外层窗口，用户批准修复。仅为 `ConfirmDialog` 遮罩增加 `stopPropagation()`，不改变取消或删除回调。永久回归先 RED 后 GREEN，双端 375/1440px 分别验证遮罩、取消、Escape、确认四条路径，窗口/草稿/条目及焦点均有断言。

本次最新构建与工作台 76、列表 43、预设 52 个报告组全部通过（171 组，其中新增 16 组），没有将此前未重跑的分组/图片套件计入本次数量。日志：`.trellis/.runtime/template-backdrop-{red,build,green,list,presets,recheck}.log`。修复前失败为“关闭删除确认不能同时关闭模板管理”；修复后补测观察为 templateRemaining=true、dialog 数量 1，且已查看截图。详情见 `recheck.md`。无新增子代理，仍未提交/归档。

## 前台测试环境修正
最终回归曾在 Electron 引导避让场景失败；诊断实际记录为 `visibility=hidden`、`frameObserved=false`、生产文档读取数 0，而直接候选读取返回 true。关闭 backgroundThrottling 不保证被遮挡窗口执行 requestAnimationFrame。前台交互运行器现在通过 CDP Focus Emulation 保持可见态，生产代码不改；独立 LAN 生命周期运行器仍实际覆盖后台/冻结/恢复，不以该模拟代替后台验收。修正后上述所有套件重新运行通过。

## 截图、资源与未验证项
截图及结构化报告：`.trellis/.runtime/workspace-qa/`；最终实际查看双端正文/导航及 320/375px 长英文删除确认截图，文字和按钮未溢出。所有截图读取后释放上下文，不入 Git。运行器 finally 关闭本次临时浏览器/服务器并清理隔离 profile。

无 schema、IPC、导出格式或移动采集路由变更，无新依赖。未检查用户实际站点缓存/数据库、真实手机/系统相机/Wi-Fi，也不声称大型真实库容量上限。最终主 chunk 613.57 kB 的 Vite 提醒及 pending-writes 临时模块类型提示保留，不影响命令退出码。
