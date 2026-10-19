# 当前行为与证据

## 排查边界
本轮为用户批准的规划阶段。业务源码和真实用户库均未修改；尚未验证用户正在访问的 Web 构建、Service Worker 或浏览器 settings 内容。不得把下列代码缺陷直接等同于用户环境唯一根因。

## R1：旧等保识别
- 原任务：`.trellis/tasks/archive/2026-10/10-13-legacy-preset-onboarding/`。原始约定仅在首次新建时提示；本轮用户期望发现全部项目为等保时即可引导。
- `src/components/ProjectList.tsx:145–161`：refreshPreset 只有在 create-group 模式调用 getLegacyPresetCandidate，进入列表不会检查。
- `src/utils/db.ts:165–212`：已有 defaultPreset 或 legacyPresetOnboarding 记录即跳过；摘要和文档必须匹配；逐条读取完整文档，并要求生成的预设 JSON 完全相同。
- `src/utils/preset.ts:114–126`：仅认可固定旧 LEGACY_PROFILE；分类为八个历史等保 ID/type。
- 仓库自带 `presets/dengbao.json:378–383` 的 profile 为“测评证据截图要求 / 测评证据”，与旧固定 profile 不同。

### 已执行的最小只读复现
使用 esbuild 将实际 `src/utils/preset.ts` 在内存编译后调用 legacyPresetFromDocument，分类输入均来自实际 dengbao.json，只改变 profile：

| 输入 | 当前结果 |
| --- | --- |
| 自带等保预设的分类 + 自带 profile | rejected |
| 相同分类 + LEGACY_PROFILE | recognized |
| 相同分类 + 缺省 profile | recognized |

结论：不仅是触发时机不同；当前判定确实会漏掉应用自带等保预设对应的项目。另有完整模板一致性限制，检查项自定义差异也会使全等保库不提示。

## R2/R3：创建与分类
- `src/components/ProjectList.tsx:475–523`：创建时通过 splitSystemNames 数量判定：一个名称永远无 groupId，两个以上才建组。创建入口未传当前 location 意图。
- `src/components/project-list/ProjectGroupDialog.tsx:13–19,166–171`：提交只有 systemName 等元字段，无创建类型；新建支持多个名称，编辑只有一个输入框。
- 编辑独立系统分支仅把提交值写入 document.meta，既不拆分多个名称，也不新建组/子系统。
- `src/components/project-list/projectListViews.ts:33–40`：分类依据持久化 groupId，不解析名称。这一依据应保留，不能通过名称显示做伪分类。
- `src/utils/db.ts:674–709`：已有系统名称拆分去重函数和同事务建组/建多系统逻辑，可复用；不能通过删除原系统并重新创建实现转组，否则图片键和 ID 会变化。

## R4：资产名称
- `src/components/Sidebar.tsx:294–335`：添加资产仅有自由输入，所有 checklist 分类统一显示核心交换机示例；freestyle 显示管理材料示例。
- `src/context/appReducer.ts:132` 起的 ADD_ASSET 会实例化分类默认检查项；分类示例仅用于空输入框展示，不改变输入值或现有创建流程。
- 既有等保分类 ID：cat-physical、cat-network、cat-security、cat-host、cat-system-mgmt、cat-app、cat-management、cat-other。
- 用户已明确仅需输入框名称示例，不需要额外点选。设计采用按分类显示 placeholder，不修改输入值、不新增控件、不预生成资产，也不扩展预设 JSON 协议。此前的可点选候选建议已撤回。

## 已有验证设施
- `node scripts/verify-presets.mjs`：真实 TypeScript 预设纯行为。
- `node scripts/verify-presets-ui.mjs` / `node scripts/verify-project-list-ui.mjs --presets`：隔离 Web/Electron IDB、引导、预设、失败路径与表单。
- `node scripts/verify-project-list-views.mjs` / `node scripts/verify-project-list-ui.mjs`：分组派生、真实列表、新建、保存与刷新失败、导航定位、三档截图。
- `npm run build`：类型检查、构建、Service Worker 生成。
- `npm run verify:pending-writes`、`npm run verify:image-store`、`npm run verify:merge-import`：转组写入和原图片关联相关回归。
- 当前仅执行上面的最小只读识别复现；未执行修复后的任何测试，未形成 UI 通过结论。

## 设计护栏
- 不把读取失败当作通用默认继续创建；不覆盖用户显式默认、不清除引导状态来强制触发。
- 新的引导检查不能阻塞摘要首屏，禁止全量 getAll 项目或图片；完整模板核对必须隔离于普通列表读取并逐条进行，保留取消/卸载与重试边界。
- 转组使用 projects/projectGroups/projectSummaries 同事务、现读现改及 trackWrite，事务 complete 后才跳转；失败所有数据不变。
- 原系统 ID、分类、profile、资产、检查项、图片引用/字节保留；新增系统采用已确认模板快照，不复制旧资产。
- 无 schema 升级、无新依赖、无真实库夹具；发布与推送不在授权范围。
