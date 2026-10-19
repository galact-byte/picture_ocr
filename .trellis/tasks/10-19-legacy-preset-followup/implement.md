# 旧等保引导实施计划

## 启动门槛与依赖
- 用户已批准整体实施，R1 实现、父任务独立检查、规范同步及连续联合验收完成；等待工作流统一本地提交确认。
- 无其他子任务功能依赖；本任务先做，后续分组任务串行修改共享 ProjectList/ProjectGroupDialog，避免互相覆盖。
- 子代理读取本目录 PRD/design/implement、jsonl 规范与父任务 research；按 TDD 实施，不另起规划流程。

## RED → GREEN → REFACTOR
- [x] `verify-presets.mjs` 先覆盖自带/缺省/自定义 profile 与附加分类；`red-model.log` 确认旧识别器漏判及未导出分类判据。
- [x] 最小修改分类判据与模板投影，14 个纯检查 GREEN；导出 `isAssessmentCategories` 供 R4 复用。
- [x] 原生隔离 IDB 的 `red-storage.log` 确认差异模板被拒绝；补混合库、摘要/文档主键不匹配、显式默认及损坏结构矩阵。
- [x] 顺序核对与最近修改/ID 同时间排序选择 GREEN；事务重查默认、失败回滚和设置保护通过。
- [x] `red-auto-ui.log` 确认只进入列表没有引导；后续自动引导、不误开创建、抢先新建复用检查 GREEN。
- [x] 延后检查、卸载/取消、读写失败、外部弹窗延后及并发默认保护通过；`red-modal.log` 确认旧弹窗叠加问题。
- [x] MutationObserver 记录摘要首屏文档读取为 0；含 1 MiB 内联图的三文档扫描峰值在途请求为 1、无批量文档/图片表读取。
- [x] 已查看 Web/Electron 三档截图联系表；CDP 实际 Tab/Shift+Tab/Escape/Enter 验证焦点环、恢复和通用选择，不将脚本 click 计为键盘证据。
- [x] 无通用扫描框架或新依赖；复用 `isInspectableProject` 拒绝损坏资产结构。

## 有序验证命令
```bash
node scripts/verify-presets.mjs
npm run build
node scripts/verify-project-list-ui.mjs --presets
node scripts/verify-project-list-views.mjs
node scripts/verify-project-list-ui.mjs
npm run verify:pending-writes
npm run verify:pwa-build
git diff --check
```
完整双端回归不以 `--web-only` 代替。当前项目没有 npm test/lint，不虚构统一测试入口；最终联合验证执行父任务相关套件。

## 失败路径核对
- [x] 非法预设/坏文档不生成候选；读取失败 reject 并进入诊断，后台失败有 Toast，主动新建可重试。
- [x] 无项目、新用户、混合库、已选通用、已有默认均受保护；显式选择时文档扫描为 0。
- [x] settings put/abort/受控缩短超时的真实 abort 均回滚；取消不写完成标记，失败后可重试。
- [x] 重挂载、关闭和卸载拒绝迟到结果；打开超时后的迟到连接关闭，见 `red-open-timeout.log` 及最终 GREEN。

## 证据与收尾
截图/测试报告保存在忽略的 `.trellis/.runtime/preset-qa/`；只使用合成隔离库。由 trellis-check 审核 PRD 对应验收，之后按 trellis-update-spec 更新识别/触发契约和质量检查。提交仅包含本任务相关文件，不包含用户原有 workflow.md 改动，不推送或发布。

## 回滚点
每个 GREEN 后保存可追溯差异；失败先保留测试与日志定位。回退业务代码即可，不降 DB 版本、不清 settings、不删除项目。用户数据不得当作测试回滚对象。

## 本轮验证记录
- 日志根目录：`.trellis/.runtime/preset-group-experience/`，最终命令输出为 `final-*.log`；全部有序命令退出码 0，另跑 `npm run verify:lan-mobile-picker`。
- 结果：纯预设 14 个检查；预设 UI Web/Electron 52 个报告组；普通列表 UI 双端 43 个报告组；pending-writes 32/32；列表派生、PWA、响应式源码检查及 `git diff --check` 通过。
- 原始截图：`.trellis/.runtime/preset-qa/{web,desktop}-onboarding-{375,768,1440}.png`；两个 `*-onboarding-contact.png` 已人工核对文字、窄屏换行和按钮/焦点样式。
- RED：`red-model.log`、`red-storage.log`、`red-auto-ui.log`、`red-modal.log`、`red-open-timeout.log`、`red-damaged-structure.log`。最终实现差异快照见 `implementation.diff`。
- 普通列表夹具现显式选择通用，避免新增独立后台扫描混入批量导出读取计数；原 15 次读取、单次下载、无源写入等断言未放宽。
- Vite 主 chunk 604.29 kB 阈值警告、Node 临时文件模块类型警告仍存在；没有统一 npm test/lint 入口，未虚构此类验证。
- 未测真实用户库、真机和大型真实库容量/耗时；跨窗口默认竞争用独立原生 IDB 连接写入模拟。未提交、切分支、归档、推送、发布或改写原有 workflow.md。
- 上述为 R1 阶段运行记录。最终主会话已完成 R2/R3/R4、独立 trellis-check 和规范同步；双端引导 52、分组/联合 32、普通列表 43 个报告组，纯预设 15、pending-writes 35/35。最终证据和未验证项见父任务 verification.md，等待统一本地提交确认，不把单项通过替代联合验收。
