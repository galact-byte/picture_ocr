# 批量数据包导出实施与验证计划

## 启动门槛

- [x] 用户审阅 PRD 和设计，批准总 ZIP（内部独立系统 ZIP）、既有选择范围与实施。
- [x] 阅读 `trellis-before-dev`、任务三份文档和 JSONL 中相关规范；查询真实当前任务。
- [x] 运行 `task.py validate`，再按批准执行 `task.py start`；未批准前保持 planning，不写功能代码。
- [x] 记录实施前 git status/diff，保留其他任务的未提交修改。

任务范围集中、证据已定位，默认主会话直接实施和检查；不因流程建议单独派遣子代理。若确需派遣，提示首行使用 task.py current 得到的 Active task 路径。

## 1. Red：补公共行为验证

- [x] 复用 `scripts/project-list-browser-cases.mjs` 及 `scripts/verify-project-list-ui.mjs` 的隔离生产 Web/Electron、图片夹具、URL Blob 捕获和原生 IndexedDB 测试方式；扩展批量场景，不另建测试框架。
- [x] 新增至少 15 系统夹具，测试组内全选、子集、独立系统、搜索全选与当前选择范围。
- [x] 捕获下载次数和 Blob：只下载一次，打开总 ZIP 并逐个打开子 ZIP，断言选中数量、系统名、profile、模板、资产、图片路径及字节内容；覆盖净化后同名、大小写同名和路径分隔符。
- [x] 子包调用真实 `importDataPackage` 验证覆盖与合并结果，而非只检查源码字符串。
- [x] 追加归档混选、最新文档归档、文档删除/读取失败、内联及引用图、缺失字节、打包异常、快速双击和失败重试场景；断言失败无下载、忙碌态释放与源数据未被写回。
- [x] 先构建并跑新增 Web 公共场景，确认因为缺少批量功能而失败。故障注入仅存在于测试，不改生产超时或真实数据。

## 2. Green：最小实现

- [x] `exportImport.ts` 新增顺序批量编排，复用既有打包/下载/文件名净化；拒绝空 ID 集合、归档文档和图片缺失；子包文件名包含系统名并消除包内冲突。
- [x] `ProjectList.tsx` 使用选中可见系统快照发起导出；提供同步防重入 guard、进度状态、统一错误和 finally 清理，保护本窗口源操作与选择。
- [x] `ProjectListHeader.tsx` 增加独立系统批量入口；项目组内已选工具区增加相同操作。延续原勾选、切页和搜索规则，不修改批量删除语义。
- [x] 显示“解压后可逐个导入”及准确的下载反馈；README 在既有备份说明内补充批量导出与恢复步骤。
- [x] 跑新增场景直到通过，检查慢速/失败时按钮恢复和原选择保留。

## 3. Refactor 与全面回归

- [x] 只在实际重复处复用按钮和提示逻辑，不另造状态管理或包协议；检查新增 public API、调用参数和源数据只读性。
- [x] 使用 `trellis-check` 主会话检查规范、验收映射、错误分支、生命周期和类型。
- [x] 执行相称的完整验证：

```bash
npm run build
node scripts/verify-project-list-ui.mjs
node scripts/verify-project-list-views.mjs
npm run verify:image-store
npm run verify:evidence-package
npm run verify:archive-format
npm run verify:lan-mobile-picker
git diff --check
```

- [x] 截图和报告存 `.trellis/.runtime/project-list-qa/`。检查 375/768/1440px 的独立系统、项目组展开及已选批量操作区，使用 CDP 真实 Enter/Space 验证按钮与全选键盘行为。
- [x] 检查一次下载的真实产物：除了 Blob 内容断言，在隔离测试下载目录用浏览器下载事件/下载文件检查确认最终文件可打开；桌面正式 main/preload + 临时 userData 跑同样入口，不用用户真实库。
- [x] 使用 15 个带图片的模拟系统记录打包耗时及资源现象，确认顺序读取且未同时持有所有 hydrated 文档；不据此保证用户大型真实库的容量上限。
- [x] 回归现有单系统菜单导出、ZIP 覆盖/合并导入、加密信封和归档格式。项目无 lint 命令，`npm run build` 为类型与构建基线。

## 4. 收尾与提交门槛

- [x] 使用 `trellis-update-spec` 评估并记录批量总包、只读编排和完整性校验的稳定契约。
- [x] 通读用户文案和 README，确保说明总包解压步骤与实际完成状态。
- [x] 查看实际 git status、diff 和验证证据；仅把本任务代码、文档及任务规划列入拟提交范围。
- [x] 按 `.trellis/workflow.md` Phase 3.4 给出一次提交计划，取得批准后完成本地提交；发布由后续流程处理。

## 验证记录

- `npm run build`：通过（TypeScript、Vite、Service Worker）。
- `node scripts/verify-project-list-ui.mjs`：通过，Web 22 项、Electron 21 项，共 43 项；包括 15 系统总 ZIP、真实覆盖/合并导入、缺图/归档/读取/打包失败、重试、防重入、顺序读取、零写事务、卸载取消、375/768/1440px、CDP Space/Enter 与实际下载文件。
- `node scripts/verify-project-list-views.mjs`：通过。
- `node scripts/verify-image-store.mjs`：76/76 通过。
- `node scripts/verify-evidence-package.mjs`：Web/Electron 加密包回归通过。
- `node scripts/verify-archive-format.mjs`：通过。
- `node scripts/verify-lan-mobile-picker.mjs`：通过。
- `git diff --check`：通过；仅有既存 `RELEASE-NOTES.md` 的换行提示。

最终发布基线记录在 `.trellis/.runtime/v0.11.3-check-results.json`，25 条命令全部 exitCode=0；完整列表双端日志为 `.trellis/.runtime/v0.11.3-check-23.log`。独立 trellis-check 子代理未能启动，按同一清单完成主会话检查，无独立子代理证据。

已取得老师对三批范围的一次性批准，本地工作提交为 `255df1b`（实现与回归）、`9338c45`（规范与验收记录）和 `b645436`（v0.11.3 发布准备）。本任务本地验收及提交完成，进入归档与日志记录；尚未推送、打标签或发布。
