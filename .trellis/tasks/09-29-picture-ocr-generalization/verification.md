# 通用化验收记录

## 结论与范围

按用户批准的 A 方案实现 R1–R8，主代理已复核并修复首次实现的缺口。真实验证使用隔离 Chrome 和 Electron 数据目录，没有打开用户实际数据库。版本仍为 0.9.0，未推送、打标签或发布。

## 实际执行

| 检查 | 结果与证据 |
| --- | --- |
| `npm run build` | 通过；严格类型检查、Vite 与 PWA 构建；`.trellis/.runtime/preset-build.log` |
| `node scripts/verify-presets.mjs` | 9 组通过：通用默认、深拷贝、旧项目固定回退、分类 action、命名、协议边界和白名单 |
| `node scripts/verify-presets-ui.mjs` | Web 7 组、Electron 7 组通过；原生 IDB、真实包与 Word、UI 及 3 档宽度；`preset-green.log` 和 `preset-qa/results.json` |
| `verify:summary-repair`、`verify:list-summary-store`、`verify:image-store` | 通过；升级与摘要/图片路径回归 |
| `verify:archive-model`、`verify:archive-format`、`verify:archive-flow` | 通过；最后补充 profile 归档与恢复断言后 flow 双端 110 条检查通过，见 `preset-archive.log` |
| `verify:evidence-package`、`verify:lan-mobile-picker` | 通过 |
| `verify-project-list-views.mjs`、`verify-project-list-ui.mjs` | 通过；列表 UI Web 19 组、Electron 18 组 |
| `verify:data-location`、`verify:pwa-build` | 通过 |
| `git diff --check` | 通过；只有既有行尾配置的 LF/CRLF 提示 |
| 等保本地文件 | 与修改前 `HEAD:src/data/defaults.ts` 逐字段深比较一致：8 类、62 检查项；gitignored、未跟踪，构建 JS 未包含原 6 个行业分类名 |

13 个串行回归脚本的退出码全部为 0，记录在 `.trellis/.runtime/generalization-regression.log`。新增输入限制后重新通过模型测试；最终构建后再次运行预设 UI 和加强后的归档 flow。

## R1–R8 对照

- R1：默认一类、可选截图、无示例资产；实际 UI 新增和改名分类并等待落库，reducer 检查资产引用不变。
- R2：默认预设保存/读取/切换、非法版本和受控 IDB 保存错误；错误后原默认不变。类型、数量、1 MiB、名称/ID 长度及重复 ID 在纯模型验证。
- R3：Word ZIP 内 document.xml/core.xml、ZIP 和加密包检查 profile；文件名净化。项目设置保存失败弹窗保留，重试成功后落库并重开检查。
- R4：通用空单位创建、预设自定义单位必填、组内采用组 profile 及默认分类；组/成员的必填校验在同一事务中执行。
- R5：旧项目/旧包固定兼容值，明确空分类保持空，合并保留目标配置。归档文件和恢复后的文档/摘要均检查 profile，图片原回归全通过。
- R6：实际工作台另存、改名、导出捕获 JSON，验证无 meta/assets，再从界面导入；另存表单可编辑报告字段。
- R7：本地预设内容与修改前模板一致，未跟踪、不参与构建。
- R8：README 提供两端各导入一次、旧项目另存和配置入口；预设弹窗含标签、键盘焦点处理、保存中互斥和错误提示，无自行添加的说明小字。

## RED 与修复

- `preset-red.log`：组内新增系统实际得到通用分类而非导入预设；修正创建边界使用快照后通过。
- `preset-red2.log`：ZIP/加密包命名未净化参与文件名的元数据；补统一净化后通过。
- `preset-red3.log`：预设读取失败仍允许创建；新增加载/失败/重试状态并禁止提交后通过。
- 另存功能补齐可编辑弹窗，已通过实际 UI 导出再导入验证。
- 最后增加超长名称/ID、跨分类重复模板 ID 的测试，先得到 Missing expected exception，再补校验，最终 9 组通过。
- 验证中遇到 TS 目标不支持 Array.at，改为索引后构建通过；测试故障注入阻断了读取时遗留迁移，改为先撤销注入再核对数据；归档测试先误读 archive.json 对象，修正检查 packageManifest 后全通过。这些是开发/测试问题，不视为用户真实损坏。

## 可查看截图

`.trellis/.runtime/preset-qa/` 下有 Web/Electron 各自 375、768、1440px PNG。主代理已打开检查 Web 375px 和 Electron 1440px：弹窗无横向溢出、无新增说明小字；故障注入 Toast 已通过关闭按钮清理后截图。

## 验证边界与回滚

未制作新版本 EXE/Web ZIP、未使用用户真实存档、未进行人工 Microsoft Word 渲染检查；Word 已验证生成的 DOCX XML 与属性。Web UI 使用隔离本地静态宿主，Electron 使用仓库现有二进制。

已升级到 DB v6 的环境不可用 v5 程序直接打开；如需回滚应保留 v6 结构版本，仅回退业务实现，或由用户恢复已备份的完整数据。本次测试进程和隔离临时目录均由 harness finally 清理。
