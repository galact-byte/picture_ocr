# Backend Database Guidelines

## 现状

仓库没有服务端数据库、ORM 或服务端迁移系统。所有项目数据保存在浏览器本地 IndexedDB（`src/utils/db.ts`），Web 版与桌面版（Electron 渲染进程）共用同一套代码。局域网服务（`start-server.ps1` / `electron/lanServer.cjs`）只转发上传，不持有数据库。

## IndexedDB 结构（`DB_VERSION = 6`）

| store | keyPath | 索引 | 内容 |
| --- | --- | --- | --- |
| `project` | `id` | `updatedAt` | v1 遗留单项目，仅供 `migrateLegacyProjectIfNeeded` 迁移 |
| `projects` | `id` | `updatedAt`、`groupId` | `ProjectDocument`（系统），图片只存引用 |
| `projectGroups` | `id` | `updatedAt` | `ProjectGroup`（项目组元数据） |
| `projectSummaries` | `id` | `updatedAt` | 列表用轻量摘要（`id/groupId/meta/assetCount/createdAt/updatedAt/archive`），无图片字节 |
| `images` | `key` | `by_project(projectId)` | 图片字节，主键 `${projectId}:${imageId}` |
| `settings` | `id` | — | 默认 `ProjectPreset`，固定 key `defaultPreset`，只保存模板与 `ProjectProfile` |

- `settings` 的记录为 `{ id: 'defaultPreset', preset: { version: 1, name, categories, profile } }`，不包含项目身份、单位值、资产实例或图片；`getDefaultPreset()` 无记录时返回通用默认值，保存/读取必须深拷贝。
- 预设 JSON 在文件边界执行 version、类型、ID、顺序、数量、文本长度和 1 MiB 限制校验；导入失败不得写入 settings。
- `onupgradeneeded` 只建表/建索引；遍历数据的回填放在升级完成后（`ensureSummariesSynced`、`migrateInlineImages`），否则一条坏数据会中止 versionchange 并回滚版本。
- 未迁移的老项目仍可能在 `ImageData.data` 内联 Base64，两种形态共存；读图必须经 `resolveImageData` / `hydrateAssets`，不能直读 `image.data`。

## 预设与项目配置契约

### 1. 范围

应用内导入预设、项目/组创建、项目配置编辑，以及文档/摘要/导出包之间的配置传递。仅新项目采用当前默认，旧项目不随默认改变。

### 2. 接口

- `getDefaultPreset(): Promise<ProjectPreset>`、`saveDefaultPreset(preset): Promise<void>`。
- `createProjectDocument(meta?, groupId?, preset?)` 是同步工厂；UI 必须先读取预设并传入同一快照。
- `createSystemForGroup(group, systemName, preset?)` 使用组的 profile；未传 preset 时异步读取默认分类模板。
- `updateProjectGroupAndSystems(group)` 在读写事务内检查组及成员单位必填规则。

### 3. 数据契约

`ProjectProfile = { reportTitle, exportFilePrefix, unitFieldLabel, unitFieldRequired }`。旧文档/组/旧包使用固定通用标题与前缀、单位名称及必填 true。显式空分类数组不能回填；覆盖导入采用包配置，合并保留目标配置。settings 只在事务 complete 后报告保存成功；列表依旧只读取摘要。

### 4. 校验与错误

| 输入或状态 | 处理 |
| --- | --- |
| 无默认记录 | 返回通用默认；单位可选且无示例资产 |
| 读取失败/坏记录 | reject；创建表单禁止提交并提供重试，不能静默创建通用项目 |
| JSON 超 1 MiB、版本/字段类型错误 | 拒绝且保留原默认 |
| 分类或模板 ID 重复、名称/ID 超 500 字符 | 拒绝；模板 ID 在整个预设内唯一 |
| 组单位为空且组或任一成员必填 | 事务中止，组和成员不变 |
| 项目设置写入失败 | 表单保留输入；不提前派发配置或报告成功 |

### 5. 正常与边界

导入“巡检”后新建的独立系统使用巡检配置；之前创建的通用系统仍保持通用配置。组内新系统采用当前分类模板和既有组配置。坏预设失败后再次读取仍返回上一个合法默认。

### 6. 验证

`verify-presets.mjs` 校验模型、深拷贝、输入边界及 reducer；`verify-presets-ui.mjs` 在隔离 Web/Electron 验证原生 IDB、组成员规则、失败重试、配置保存重开、ZIP/加密包与 DOCX；`verify:archive-flow` 断言归档清单和恢复后的文档/摘要保留 profile。

### 7. 反例

错误：预设读取 catch 后使用 DEFAULT_PRESET 继续创建；组内新建只调用无 preset 的同步工厂。正确：加载失败阻止创建并允许重试；提交使用表单已加载的快照，组内配置从组获取。

## 写路径不变量

- 所有写用户数据的路径经 `trackWrite()`（`src/utils/pendingWrites.ts`），成功/失败都释放计数；新增写路径同步补 `scripts/verify-pending-writes.mjs`。
- 写/删/迁移项目的事务内同步维护 `projectSummaries`。
- 图片增删走 `addImageToProject` / `removeImageFromProject`：单事务覆盖 projects/summaries/images，文档在事务内现读现改，不接受调用方的整份内存快照。
- 超时：普通事务 `withTimeout` 15s，`openDB` 60s，整份文档读写 `DB_DOC_TIMEOUT_MS` 120s。图片写入与归档事务超时时只请求 `abort`，以真实 `oncomplete`/`onabort` 结算，不用包装 Promise 超时推断「没有写入」。

## 归档与恢复事务

### 1. 范围

系统（`ProjectDocument`）可归档到用户选择的目录：本地删除图片字节，保留文档、摘要与组元数据，并以 `archive: ArchiveInfo` 标记。编排在 `src/utils/archive.ts`，库内提交在 `db.ts`。

### 2. 接口

- `commitProjectArchive(projectId, expectedImageIds, info): Promise<void>`
- `restoreProjectArchive(projectId, fingerprint, records: StoredImage[]): Promise<void>`
- 共用 `runArchiveTransaction`：projects/summaries/images 三 store 读写事务，经 `trackWrite`，失败原因写 `recordError`。

### 3. 数据契约

- `ArchiveInfo = { archivedAt, fileName, locationLabel, imageCount, imageBytes, fingerprint }`，`fingerprint` 为 64 位小写 hex（归档清单 SHA-256）。
- 标记存在于文档与摘要两处，所有派生（`normalizeProjectDocument`、`toProjectSummary`、摘要补建）必须经 `normalizeArchiveInfo` 透传；漏一处会在下次保存时抹掉标记，形成「本地无图片又不显示已归档」。
- 归档/恢复都不改 `updatedAt`，「最后修改」保持业务语义。

### 4. 校验与错误

- 提交：文档不存在/无效、已归档、仍有内联图片、文档引用集合或 `by_project` 主键集合与 `expectedImageIds` 不一致（归档期间有上传/删除）→ 整体 abort，本地不动。
- 恢复：未归档、`fingerprint` 不符、记录的 `projectId`/`key` 与目标不符、非 data URL、记录集合 ≠ 文档引用集合 → 拒绝；任一 `put` 失败整体回滚。
- 已归档只读：`saveProject` / `saveProjectWithImages` 在写事务内读摘要，库里已归档时只接受携带同一指纹且不写图片字节的写入；`addImageToProject` / `removeImageFromProject` 对已归档文档 abort。工作台 `buildDocument` 不带 `archive` 字段，这道兜底防止经 URL 打开后的自动保存把标记写成 null。
- `reconcileProjectImages` 对已归档项目不报缺失图片。

### 5. 编排顺序（`archiveProject`）

整理内联图片 → 对账（有缺图拒绝）→ 打包 → 写入目标目录（不覆盖同名，自动加序号）→ **从磁盘重新读回**逐张校验 SHA-256 → `commitProjectArchive`。任何一步失败都不删除本地数据，结果以返回值汇总，不抛出。批量按顺序逐个执行以控制内存峰值。

### 6. 验证

`verify:archive-model`（隔离 IDB 实测透传、事务与只读兜底）、`verify:archive-format`、`verify:archive-files`、`verify:archive-flow`、`verify:pending-writes`；界面双端 `npm run build` 后 `verify:archive-ui`。

### 7. 错误与正确

错误：写完归档文件就删本地字节，或用内存里的 Blob 充当「读回」。正确：目标的 `read` 必须重新从磁盘读取，校验通过后由单事务在比对集合后删除并打标记。

## 反模式

- 不为前端任务引入服务端数据库假设或 ORM。
- 不用 `getAll()` 全量读 `projects`（图片可能仍内联，大库会卡死/OOM）；列表与统计只读摘要，占用统计用 `measureProjectImages` 游标逐条累加。
- 不把无关应用状态放进 IndexedDB；提醒阈值、占用统计缓存等本机偏好放 localStorage（`evidence-storage-reminder-v1`、`evidence-storage-stats-v1`）。
