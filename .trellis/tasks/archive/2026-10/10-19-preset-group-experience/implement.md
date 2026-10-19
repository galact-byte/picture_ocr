# 父任务实施与集成计划

## 当前阶段
R1–R5 已按顺序实现并完成最终集成复验；R5 独立审查反馈已修正，文档和提交方案已更新。等待 workflow 3.4 的一次性本地提交方案确认，尚未提交/归档。证据见 verification.md。

## 启动门槛
- [x] 所有子任务 PRD 收敛，R1/R2/R3 具有 design.md 与 implement.md，R4 为轻量 PRD-only。
- [x] 父子任务 implement.jsonl / check.jsonl 有真实规范/研究路径并通过 task.py validate（4 个任务全部通过，父子关系与引用路径检查通过）。
- [x] 用户审阅用户可见行为、原证据保留规则与兼容性并批准实施。

## 执行顺序
- [x] R1 按子任务实施并完成聚焦测试；使用 Trellis 实现代理，主会话核对实际差异和验证。
- [x] R2/R3 在 R1 全绿后由主会话直接实现，共享组件串行改动；完成事务、导航、UI、原图字节和失败分支验证。
- [x] R4 由主会话直接实现，仅替换 placeholder，复用 R1 判据，不另开实现代理。
- [x] 父任务完成一次 medium 独立审查，修正真实 radio 焦点边界并补齐同库联合场景；双端 32+52+43 个 UI 报告组通过。

- [x] R5 窄屏工作台修复及焦点/断点/草稿/图片验证通过，独立审查反馈已修正；最终工作台 60、分组 32、预设 52、列表 43、图片 4，共 191 个 UI 报告组及检查项/LAN 生命周期等受影响回归通过，已撤销窄屏旧边界并更新证据。

## 联合验收矩阵
| 流程 | 必须核对 |
| --- | --- |
| 合法等保旧库进入列表 | 可发现引导，自带/旧 profile 与用户检查项差异不漏判；不挡摘要首屏。 |
| 选择等保默认并新建 | 最近等保模板正确快照，旧证据不进入预设；重开不重复提示。 |
| 组页仅新建一个成员 | 默认组选中、真实 groupId、重载仍在组列表、可再添加成员。 |
| 独立页新建与手动切换 | 类型与实际归属一致，多名称单系统校验不丢输入。 |
| 带图片独立系统编辑追加 | 首名仍为原 ID/证据，新增成员空白；组、文档和摘要一致，图片解码可见。 |
| 转组后采集/导出/重载 | 组级采集范围正确，单包按原语义可读/可导入，导航与重载一致。 |
| 各等保分类添加资产 | 逐项 placeholder 正确，空输入仍为空、不创建示例资产，原操作步骤不增加。 |
| 读/写/刷新失败及生命周期 | 原库不半写、重试不重复创建、取消/卸载不提交陈旧结果。 |

## 最终验证命令
```bash
node scripts/verify-presets.mjs
node scripts/verify-project-list-views.mjs
npm run build
node scripts/verify-project-list-ui.mjs --presets
node scripts/verify-project-list-ui.mjs --system-groups
node scripts/verify-project-list-ui.mjs
npm run verify:pending-writes
npm run verify:image-store
npm run verify:merge-import
npm run verify:evidence-package
npm run verify:archive-model
npm run verify:archive-flow
node scripts/verify-lan-group-snapshot.mjs
npm run verify:lan-mobile-picker
npm run verify:pwa-build
git diff --check
```
若子任务新增独立聚焦脚本，也须加入并执行。项目无统一 npm test/lint，以上是受影响行为与类型/构建基线，不把未执行的其他功能称为全仓测试通过。若新增差异显示影响更广，按证据追加相关既有验证，不新增无关功能。

## 证据与交付
- [x] Web/Electron 原生隔离 IDB 联合验收通过，无真实用户库操作。
- [x] 新建/示例三档截图通过；追加 R5 后已检查五档双端工作台、导航及长英文确认框。375px 原挤压已修复，真实图片核对后释放上下文，不宣称整个应用移动端重设计。
- [x] 运行器 finally 关闭测试进程/临时服务器并清 profile，未验证现场项记于 verification.md。
- [x] trellis-check 独立审查两项反馈已复现/补齐，双端复验通过。
- [x] 已同步 backend 数据接口及 frontend 状态/质量契约。
- [x] 已更新 CHANGES.md 和仅面向用户操作的 README。
- [ ] 逐项审查 Git diff、忽略配置与隐私，排除原 workflow.md 修改及 runtime/dist/tsbuildinfo，按工作流本地提交、记录并归档已完成任务。
- [ ] 最终集中报告修改与实际验证证据；不推送或发版，真实 Web 库/缓存仍属于未直接验证项。

## 回滚与停止条件
失败测试保留证据，不连续盲改；同一问题三次修复未解决则按规范停止并说明。代码可按子任务独立回退，不能以清库、删除项目、改回用户设置或降 DB 版本实现“回滚”。一旦发现超出既定数据/兼容性边界，先征得用户批准。
