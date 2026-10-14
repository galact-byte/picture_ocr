# 实施与验证计划

## 当前阶段

任务已激活，主会话完成旧模板识别、按需读取、原子选择保存及真实新建入口接入。数据目录重连已经通过 v0.11.2 发布，预设引导随下一正式版本交付。

主会话实施与检查，不使用独立子代理；所有自审结果均不得表述为独立审查。

## 执行清单

- [x] 核对历史批准、旧版等保分类结构和真实新建入口。
- [x] 激活既有任务，沿用现有预设测试框架。
- [x] Red：纯模板识别与双端存储用例确认缺失行为。
- [x] Green：`preset.ts` 仅提取分类、检查项和配置；`db.ts` 顺序只读检测与 settings 原子提交；`ProjectList` / `ProjectGroupDialog` 在点击新建时引导。
- [x] 纯行为：旧无 profile 模板、默认配置白名单、必填误判、通用/未知/损坏模板排除。
- [x] Web/Electron 原生 IndexedDB：沿用与通用、已有默认、新库、混合库、不同旧模板、无效文档、摘要遗漏、跨窗口已保存默认保护、写事务中止回滚。
- [x] Web/Electron 真实界面：沿用后新建不带原资产图片及单位、保存失败保留引导且可重试、取消不记录、选择持久化、真实重载不再提示、默认预设及模板边界不误提示。
- [x] 两端 375/768/1440px 截图与尺寸验证；CDP Tab/Shift+Tab 焦点闭环、Escape 取消及回焦、Enter 通用选择。
- [x] 首屏无完整项目和图片 store 读取；原文档与图片字节保持不变。
- [x] 类型检查、生产构建、预设原有行为与双端回归、图片 store / 列表派生 / 加密包 / 归档格式验证。
- [x] 按最后改动确认关闭/卸载拒绝过期初始化与提交结果、同步防重入。
- [x] 数据目录重连及完整列表回归完成后读取完整日志，不能把未结束进程当作通过。
- [x] 同步 README、CHANGES、规范与验收记录，检查用户可见内容。
- [x] 按真实差异划定提交范围，单独记录其他任务改动，核对本地 AI 配置与用户数据排除。
- [x] 按既有补丁版本规则确定 v0.11.3，更新 package 与 release notes。
- [ ] 经 Phase 3.4 一次性批准后提交完成实现。
- [ ] 所有发布检查通过后推标签，等待正式工作流，回读正文、标签与两份资产。

## 验证命令

```bash
node scripts/verify-presets.mjs
npm run build
node scripts/verify-presets-ui.mjs
node scripts/verify-project-list-ui.mjs
node scripts/verify-data-location.cjs
node scripts/verify-data-location-electron.mjs
node scripts/verify-image-store.mjs
node scripts/verify-project-list-views.mjs
node scripts/verify-evidence-package.mjs
node scripts/verify-archive-format.mjs
git diff --check
```

原生双端回归日志与截图存放于 `.trellis/.runtime/`，不会进入公开资产。测试仅使用隔离合成旧库，无真实客户数据。

## 最终验收证据

`.trellis/.runtime/v0.11.3-check-results.json` 的 25 条发布基线命令均 exitCode=0；`v0.11.3-check-22.log` 覆盖预设 Web/Electron 全部真实界面与存储边界，`v0.11.3-check-23.log` 为完整列表双端回归，目录重连及生产/桌面构建也通过。文档核对后未再修改生产代码。

## 发布保护与回退

- 已发布 v0.11.2 不重写标签或资产；下一版本在发布前说明版本号与依据。
- 正式 CI 从提交源码构建，不采用临时修复 EXE。
- 恢复 ZIP、本地运行时证据、客户数据库和行业预设不得加入 Git 或 Release。
- 引导仅新增 settings，旧项目和图片不修改；用户可经已有预设入口恢复通用默认。
- 正式下载未验证前不得宣称已发布。
