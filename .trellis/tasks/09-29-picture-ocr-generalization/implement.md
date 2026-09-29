# 实施与验证计划

## 启动门槛

- [x] 创建任务，读取相关现有代码和规范。
- [x] 需求、设计与计划落盘；按 R1–R8 收敛需求，保留一个实质兼容选择。
- [x] 用户确认 A 方案并批准实施；PRD/design 已同步。
- [x] 已读取并复核 TDD `writing-good-tests.md`、UI skills 与前端 hook 规范。

## 顺序与 TDD

1. **保留外置模板（R7）**：从当前 defaults 生成本地 `presets/dengbao.json`（8 分类、完整检查项，旧报告文案/前缀，单位必填）；追加精确 gitignore 规则，验证未跟踪且不进入构建。若文件已存在先比较，不覆盖用户文件。
2. **纯模型 RED → GREEN（R1–R4、R6）**：新增 `scripts/verify-presets.mjs`，沿用 esbuild + Node assert 运行真实 TS；先证实新行为缺失，再实现默认值、运行时校验、快照独立性、旧项目固定回退、另存预设及净化命名。测试包括空值、错误版本/类型/重复 ID、嵌套拷贝隔离与预设不含实际项目数据。
3. **存储 RED → GREEN（R2、R4、R5）**：隔离原生 IndexedDB 覆盖导入保存/重开、保存失败保持旧默认、升级不遍历数据、旧项目保持必填、组及系统创建与摘要透传。保持同步纯文档工厂可注入 preset；异步加载由创建边界负责。
4. **状态与导出 RED → GREEN（R3、R5）**：实际 reducer 测试新增/改名及引用保持、加载/保存 profile；真实 ZIP manifest 与 DOCX XML 检查配置往返、标题、文件名、旧包兼容、合并保留目标、归档恢复透传；不复制生产算法进测试。
5. **UI RED → GREEN（R1–R4、R6、R8）**：隔离 Web/Electron 自动化先验证入口/表单行为缺失，再实现预设管理、当前项目另存、项目设置、分类编辑、单位动态标签和 required。覆盖取消、非法文件、写库失败、重复提交、切换默认不改旧项目和重开持久化。
6. **回归与文档**：README 写普通用户操作和双端独立设置；CHANGES 只记实际验证事实；有针对性整理重复代码并复跑受影响验证。
7. **收尾**：trellis-check 审查 R1–R8 与数据全链路，更新 spec 契约，diff/check 通过后按项目流程本地提交；不推送、不发布、不修改版本号。

## 验证命令与范围

新增脚本名称为计划，创建前不声称已存在或通过。

- `node scripts/verify-presets.mjs`：模型、校验、快照、分类 reducer、包和 Word 配置。
- `node scripts/verify-presets-ui.mjs`：隔离 Web/Electron 原生 IDB 与界面；375/768/1440 截图，失败证据与报告放 `.trellis/.runtime/preset-qa/`。复用仓库 CDP 驱动与临时宿主，结束清理所有自建进程和目录句柄。
- `npm run build`：严格类型检查与生产构建，必须在 UI 验证之前通过。
- `npm run verify:summary-repair`、`npm run verify:list-summary-store`、`npm run verify:image-store`：升级/摘要/图片兼容。
- `npm run verify:archive-model`、`npm run verify:archive-format`、`npm run verify:archive-flow`：包与恢复配置不丢失。
- `npm run verify:evidence-package`、`npm run verify:lan-mobile-picker`、`node scripts/verify-project-list-views.mjs`、`node scripts/verify-project-list-ui.mjs`：包和项目创建/编辑回归。更新旧硬编码文案/默认资产断言时必须保留原测试业务意图。
- `npm run verify:data-location`、`npm run verify:pwa-build`：数据定位和共用构建不回归。
- `git diff --check`、`git check-ignore presets/dengbao.json`、`git ls-files presets/dengbao.json`：格式、忽略且未跟踪。搜索构建产物确认本地行业模板未打包。

## 风险核对

- 不用用户真实库；不把故障注入当作真实数据损坏复现。
- 表单预设加载失败禁止保存，不能假装读取到了通用默认。
- 旧组编辑及组内新建的单位规则必须与成员项目一致；不让默认预设改变已有成员。
- AppContext buildDocument、ZIP normalizeImportedMeta/ImportResult、归档重建与 summary 各处都是可能丢 profile 的位置。
- 保留归档只读守卫、图片引用/字节分离和事务提交后才报告成功。
- 失败命令如实记录，修复后补跑；未验证的真机部分明确列出。

## 进度证据

已完成 R1–R8 实现、build、新增模型与双端 UI 测试、13 个受影响回归脚本，以及加强后的归档配置检查。主代理独立修复组内预设丢失、文件名净化、加载失败误创建、配置保存错误处理等问题。用户要求不额外增加说明小字，已去除并通过截图复核。

详细命令、RED/GREEN 证据、验收对照与未覆盖边界见 [verification.md](verification.md)。实现与规范完成，交付采取本地工作提交；版本维持 0.9.0，不推送或发布。
