# 显式系统类型与转组实施计划

## 启动与顺序
- 用户已批准并启动；实现、独立审查修正与双端联合验收完成，等待工作流提交确认。
- 功能本身不依赖等保引导，但共享 ProjectList/ProjectGroupDialog，执行顺序为引导 GREEN → 本任务 → 资产示例 → 联合检查。不并行编辑共享文件。

## 有序 TDD 清单
- [x] RED：在真实列表测试中覆盖组列表新建仅填一个名称仍产生真实组，独立列表默认单系统，两处可手动切换；先观察预期行为断言失败。
- [x] GREEN：提交显式类型，组分支允许一成员，单系统多名明确校验；异步预设/引导不重置表单选择和输入。
- [x] RED：拆分规则测试覆盖中文/英文逗号、顿号、换行、重复/空白与普通名称内空格；独立编辑不能因一个普通空格自动转组。
- [x] GREEN：局部扩展已有解析器的分隔策略，维持其他调用的兼容行为。
- [x] 缺转组 API 的 RED 使用真实 HEAD 历史源码于实现后单独复核，明确为 undefined/function 断言失败，非装载错误；未声称实现前单独跑过此项。原生 IDB 转组行为已 GREEN。
- [x] GREEN：实现窄职责同事务转组入口，源现读现改，保留 ID/证据，写组/文档/摘要，追踪写入并按真实事务终态结算。
- [x] 增加事务 put 失败/abort/超时、源已删除/归档/转组/版本陈旧测试：组、原系统、新系统与摘要均无半写，图片字节无变动。
- [x] RED → GREEN：独立系统编辑追加多个名称后自动定位展开新组；组内单系统编辑不再建组。
- [x] 覆盖保存成功但列表刷新失败后重试定位、不重复创建、取消/保存失败不跳转、防重入、重开与页面重载。
- [x] 核对全量图片引用/字节、原分类/profile/检查项一致；新增系统资产为零，非仅断言列表数量。
- [x] 先全绿再必要重构，不扩展拆组/合并组/自动修复历史字符串功能。

## 有序验证命令
```bash
node scripts/verify-project-list-views.mjs
node scripts/verify-presets.mjs
npm run build
node scripts/verify-project-list-ui.mjs
node scripts/verify-project-list-ui.mjs --presets
node scripts/verify-project-list-ui.mjs --system-groups
npm run verify:pending-writes
npm run verify:image-store
npm run verify:merge-import
node scripts/verify-lan-group-snapshot.mjs
npm run verify:lan-mobile-picker
git diff --check
```
如为窄职责事务行为新增脚本，必须在实现记录中补入真实可运行命令并执行，不只在浏览器用例里复制生产算法。无 npm test/lint，不虚构命令。

## 人工/真实界面核对
- [x] 隔离 Web/Electron，375/768/1440px：类型选择、字段错误、组内定位均可见，无横向溢出。
- [x] 原生 radio 用 Tab/方向键切换，Enter/Space 激活真实控件，记录焦点和错误关联。
- [x] 单成员组重载仍在组列表；原系统证据图片能实际解码，并核对字节内容。
- [x] 新组组级采集范围包含原系统和新增系统；原单系统 ZIP/加密包导出可读，导入按既有语义工作，不声称单包恢复组归属。

## 执行结果
- RED：`red-group-parser.log`、`red-group-ui.log`；历史源码缺 API 复核为 `red-group-api-baseline.log`。
- 独立审查发现 radio 组选中时 Shift+Tab 逃出模态；`red-radio-focus.log` 实测为背景“更多”，修正后双端方向键和正反 Tab 闭环通过。
- 共享 UI 运行器的 `--system-groups` 双端 32 个报告组通过；含同库引导→单成员组→两图原系统转组→采集快照→ZIP/加密包导出导入→图片解码和示例。
- 普通列表 43、预设 52 个双端报告组与父任务全部受影响回归通过，pending-writes 新增路径断言后 35/35。
- 最终记录见父任务 `verification.md`。原桌面工作台窄屏工具栏局限另列，未扩大修改范围；新建弹窗和新增输入框三档检查通过。

## 审查、记录与回滚
- trellis-check 逐项核对 PRD 的 A1–A6，检查写入原子性、图片键稳定、异常终态与导航。
- 运行命令/截图/报告写在忽略的 `.trellis/.runtime/project-list-qa/` 或对应现有测试目录，测试后结束临时进程。
- 更新持久化与新建/转组 spec；父任务集中更新 CHANGES.md 的已验证事实。
- 提交保留用户原有 workflow.md 修改；无推送/发布。回退代码不自动拆已成功创建的组；严禁删除用户数据模拟回滚。
