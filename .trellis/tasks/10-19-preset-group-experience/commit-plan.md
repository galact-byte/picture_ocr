# 提交与交付方案（已获授权）

用户在最终修复验收后明确要求“没问题就提交推送构建文件”。执行顺序：工作提交 → 归档提交 → 日志提交 → 推送当前 `fix/preset-group-experience` 分支；不 amend、不强推、不改 main、不创建标签或发布 Release。按仓库现有忽略规则，Web ZIP 和 Windows 便携版在独立本地目录交付，不将构建文件强制加入 Git。执行结果以交付记录和实际提交为准。

## 1. 工作提交
`fix: 修正等保引导、系统分组及窄屏工作台`

范围为用户批准的 R1–R5 及必要测试/规范：
- `src/utils/db.ts`
- `src/utils/preset.ts`
- `src/components/ProjectList.tsx`
- `src/components/Sidebar.tsx`
- `src/App.tsx`
- `src/components/WorkspaceLayout.tsx`（新增）
- `src/components/Toolbar.tsx`
- `src/components/ContentArea.tsx`
- `src/components/ConfirmDialog.tsx`
- `src/components/project-list/ProjectGroupDialog.tsx`
- `scripts/preset-browser-cases.mjs`
- `scripts/project-list-browser-cases.mjs`
- `scripts/system-group-browser-cases.mjs`（新增）
- `scripts/workspace-browser-cases.mjs`（新增）
- `scripts/verify-pending-writes.mjs`
- `scripts/verify-presets.mjs`
- `scripts/verify-project-list-ui.mjs`
- `.trellis/spec/backend/database-guidelines.md`
- `.trellis/spec/frontend/state-management.md`
- `.trellis/spec/frontend/component-guidelines.md`
- `.trellis/spec/frontend/quality-guidelines.md`
- `README.md`
- `CHANGES.md`
- `.trellis/tasks/10-19-preset-group-experience/`（本次父任务 PRD、设计、计划、上下文、研究、验收及本提交方案）
- `.trellis/tasks/10-19-legacy-preset-followup/`
- `.trellis/tasks/10-19-explicit-system-group/`
- `.trellis/tasks/10-19-assessment-asset-names/`
- `.trellis/tasks/10-19-workspace-narrow-layout/`

这是已批准的同一父任务交付批次；单项来源与独立验收仍分属四个子任务，不含另一个桌面数据目录任务。

## 2. 归档提交
`chore(task): 归档等保预设与系统分组体验任务`

工作提交完成后，归档上述四个子任务及父任务到 `.trellis/tasks/archive/2026-10/`；只处理状态、归档位置及其必要文档引用更新。原 `10-13-desktop-data-location-reconnect` 保持原状。

## 3. 日志提交
`chore: record journal`

通过 add_session.py 记录已提交内容和真实验证结果，范围为 `.trellis/workspace/galact/` 的本轮 journal/index 变更。

## 明确排除
- `.trellis/workflow.md`：用户会话前已有修改，保留且不纳入任何提交，不还原。
- `.trellis/.runtime/`、dist、tsbuildinfo、真实用户资料及其他已忽略的本机配置。
- 用户已授权推送当前分支；Release 发布、真实用户库或线上站点操作仍排除。
