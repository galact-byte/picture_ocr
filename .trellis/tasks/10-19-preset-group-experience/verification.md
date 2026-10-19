# 实施与联合验收记录

## 状态与边界
用户已批准整体实施；R1–R5 代码、本地构建、隔离 Web/Electron 联合验收及规范同步已完成。当前等待 workflow 3.4 的一次性本地提交方案确认，尚未提交或归档，不推送或发版。原 `.trellis/workflow.md` 修改保留且不在提交范围。

## 需求到证据
| 需求 | 实施与实际验证 |
| --- | --- |
| R1 | 共享八核心分类判据；不按 profile 文本或检查项完全一致认定。摘要首屏后顺序检查，选最近修改模板；显式默认、取消/卸载、单个在途读取、超时/迟到连接、保存失败/并发设置保护均有原生 IDB 验证。预设套件双端 52 个报告组通过。 |
| R2 | 类型默认跟随当前列表，可手动切换；单成员组真实落库并重载，单系统多名称保留输入并校验；原生方向键和选中系统组后的正反 Tab 闭环验证通过。 |
| R3 | 同事务现读源，拒绝陈旧/归档/已转组/缺失；原 ID、分类/profile、检查项、内联及独立图片引用/字节保留，新成员空白。put/abort/实际超时回调/并发重复提交与保存成功刷新失败均已验证。 |
| R4 | 八分类逐项灰色示例，实际 value 为空；改名、切全局默认、未知及通用回退正确，空 Enter/取消/空失焦不创建，非空失焦保留草稿，实际名称只创建一次并保留分类检查项。无新增控件。 |
| R5 | 单 Sidebar 窄屏导航、工具栏换行、跨断点草稿/宽度和内外层模态焦点保持，320/375/768/1024/1440px 几何与截图通过；长英文确认消息折行。追加确认框遮罩点击隔离修复后，最新双端 76 个工作台报告组通过，详见 `../10-19-workspace-narrow-layout/verification.md`。 |
| 联合链路 | 同库进入列表接受旧模板 → 自定义检查项/profile 进入单成员组 → 带两张原图独立系统编辑转组 → 该组采集快照包含两名成员及原图张数 → 该原系统实际 ZIP/加密包导出与导入一致 → 图片字节比对、恢复图解码和工作台实际显示 → 同一转组系统灰色示例。Web/Electron 均通过。 |

## RED 与检查反馈
- R1 原始 RED 记录见运行目录的 red-model/storage/auto-ui/modal/open-timeout/damaged-structure 日志。
- R2 RED：`red-group-parser.log`、`red-group-ui.log` 分别确认普通空格被错误拆分及缺少显式类型。
- 转组入口另于实现后用 `git show HEAD:src/utils/db.ts` 的真实历史基线复核缺 API 的 RED（`red-group-api-baseline.log`）；并非声称该项在实现前单独执行过。当前原生 IDB 转组行为全绿。
- R4 RED：`red-asset-examples.log` 显示改名机房分类仍出现旧核心交换机示例。
- 一次 medium 独立只读审查（`review.md`）发现 radio 选中第二项的反向焦点边界，以及缺连续联合场景。`red-radio-focus.log` 实测焦点逃到背景“更多”；修正可 Tab 集合/初始焦点后，双端真实按键闭环通过，并补齐上述联合链路。
- 原列表批量导出顺序测试一次受到固定 60/300ms 等待窗口影响。改为先等首个读取到达受控挂起点，检查后显式释放；保留 15 次唯一读取、一次下载、零源写事务等原断言，最终双端 43 个报告组通过。未改变生产导出逻辑。

## 验证命令与新鲜结果
运行目录：`.trellis/.runtime/preset-group-experience/`，初次整套结果见 `validation-summary.tsv`；后续同名 final 日志为最终重验结果。

- `node scripts/verify-presets.mjs`：15 个检查。
- `node scripts/verify-project-list-views.mjs`：通过。
- `npm run build`：严格 TypeScript、Vite、Service Worker 生成通过（最终生产代码见 `focus-build.log`）。
- `node scripts/verify-project-list-ui.mjs --system-groups`：双端 32 个报告组，含连续同库链路，见 `final-system-groups.log`。
- `node scripts/verify-project-list-ui.mjs --presets`：双端 52 个报告组，见 `final-presets.log`。
- `node scripts/verify-project-list-ui.mjs`：双端 43 个报告组，见 `final-list.log`。
- `npm run verify:pending-writes`：35/35，包含新增创建/转组 helper 及两条写路径的追踪契约。
- `npm run verify:image-store`、`npm run verify:merge-import`、`npm run verify:evidence-package`：通过。
- `npm run verify:archive-model`、`npm run verify:archive-flow`：分别 100、110 个检查通过。
- `node scripts/verify-lan-group-snapshot.mjs`、`npm run verify:lan-mobile-picker`、`npm run verify:pwa-build`、`git diff --check`：通过。
- 无统一 npm test/lint，不将本次受影响套件称为全仓所有功能验证。

## R5 后最终整合复验
最新构建与 11 条回归串行全绿，见 `.trellis/.runtime/workspace-final-build.log` / `workspace-final-regression.log`：工作台 60、分组 32、预设 52、列表 43、图片 4，共 191 个 UI 报告组。检查项交互及实际 Pointer 拖拽、LAN 生命周期、手机采集静态契约、pending-writes 35/35、PWA 均通过；不是 191 个独立用例，也不代表全仓所有功能测试。Electron 被遮挡导致 rAF 未执行的前台测试问题通过仅测试侧 Focus Emulation 修正；独立后台生命周期测试仍正常运行。

### 追加确认框修复复验
后续用户授权修复模板删除确认点击遮罩会关闭两层窗口的旧问题。局部隔离点击冒泡，新增双端 375/1440px 四种关闭/确认路径；新鲜构建、工作台 76、列表 43、预设 52 个报告组通过（本次共 171 组），详情与 RED/GREEN 日志见子任务 `recheck.md`。本次没有重跑未受影响的分组/图片等套件，不混算为全部套件新鲜通过。没有新增子代理，仍未提交/归档。

## 视觉与资源
- 截图：`.trellis/.runtime/system-group-qa/{web,desktop}-{creation,asset}-{375,768,1440}.png`；引导截图位于 preset-qa。已实际查看覆盖三档宽度和双端的六张创建/示例截图，核对控件、文字和灰色示例；图片读取后已释放正文上下文。
- 用户追加 R5 后，原 375px 工作台挤压已修复：正文从 136px 恢复完整视口宽度；窄屏以“分类导航”展开原侧栏，选资产后回正文。320/375/768/1024/1440px 双端无页面横向溢出，长名称确认框和重命名编辑态已增加真实几何断言。截图与报告见 `.trellis/.runtime/workspace-qa/`。
- 验证仅使用合成隔离数据库，运行器 finally 关闭临时服务器、浏览器进程并清理临时 profile；运行时报告/截图忽略，不入 Git。

## 兼容性与未验证项
DB_VERSION、预设 version、ZIP/加密格式、图片键均不变；恢复单系统包仍不恢复组归属。无新依赖、不安装/下载工具、不触碰真实用户库。

未直接检查用户正在使用的 Web 站点构建、缓存、Service Worker 或真实数据库；未测大型真实库容量/内存上限与真实手机/Wi-Fi。最终主 chunk 以最新 build 日志为准（约 614 kB） 的 Vite 阈值警告和 pending-writes 临时模块类型警告保留，不影响命令退出码。回退代码不能撤销已成功保存的用户模板选择或自动拆分已建组。
