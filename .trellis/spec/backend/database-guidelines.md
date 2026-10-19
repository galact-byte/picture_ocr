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
| `settings` | `id` | — | 默认 `ProjectPreset`（`defaultPreset`）与旧模板引导选择（`legacyPresetOnboarding`） |

- `settings` 的记录为 `{ id: 'defaultPreset', preset: { version: 1, name, categories, profile } }`，不包含项目身份、单位值、资产实例或图片；`getDefaultPreset()` 无记录时返回通用默认值，保存/读取必须深拷贝。
- 预设 JSON 在文件边界执行 version、类型、ID、顺序、数量、文本长度和 1 MiB 限制校验；导入失败不得写入 settings。
- `onupgradeneeded` 只建表/建索引；遍历数据的回填放在升级完成后（`ensureSummariesSynced`、`migrateInlineImages`），否则一条坏数据会中止 versionchange 并回滚版本。
- 未迁移的老项目仍可能在 `ImageData.data` 内联 Base64，两种形态共存；读图必须经 `resolveImageData` / `hydrateAssets`，不能直读 `image.data`。

- `loadProject(projectId, options?: { migrateLegacy?: boolean })` 默认先检查 v1 遗留单项目迁移。批量导出读取列表里已经存在的系统时传 `{ migrateLegacy: false }`，避免仅为读取而打开迁移读写事务；不能将此选项当成所有入口的默认值或用来跳过新库初始化。`hydrateAssets` 只补齐返回值，不写回图片或文档，缺失字节会保留原引用，调用方必须另行校验完整性。

## 预设与项目配置契约

### 1. 范围

应用内导入预设、项目/组创建、项目配置编辑，以及文档/摘要/导出包之间的配置传递。仅新项目采用当前默认，旧项目不随默认改变。

### 2. 接口

- `getDefaultPreset(): Promise<ProjectPreset>`、`saveDefaultPreset(preset): Promise<void>`。
- `getLegacyPresetCandidate(signal?: AbortSignal): Promise<ProjectPreset | null>`：摘要首屏后延后核对，新建可复用在途检查；已有默认或引导选择时返回 null。顺序只读核对全部系统及摘要主键，`isAssessmentCategories(value: unknown)` 要求八个合法核心分类 ID/type，允许改名、附加分类、检查项与合法 profile 差异。全部确认后按 updatedAt 倒序、ID 升序提取最近模板；混合/不确定库不提供继承，坏读取 reject，取消/超时关闭连接，迟到 open 也须关闭。
- `completeLegacyPresetOnboarding(preset: ProjectPreset | null): Promise<ProjectPreset>`：null 表示继续通用；同一 settings 事务内重查现有默认与选择，保护其他窗口已经保存的默认，保存继承配置和选择记录后以实际 complete/abort 结算。取消不写记录。
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

## 显式创建类型与独立系统转组

### 1. 范围与触发
单系统/系统组创建，以及无 groupId 的系统在编辑时以显式分隔符追加多个名称；不做后台拆名、合并或拆组，无 schema/版本升级。

### 2. 接口
- `splitSystemNames(value: string, splitWhitespace = true): string[]`：创建维持旧空白分隔兼容；独立编辑传 false，只按中英文逗号、顿号和换行拆分，普通名称中的空格保留。
- `convertIndependentSystemToGroup(sourceId: string, values: ProjectMeta, expectedUpdatedAt: number, preset: ProjectPreset): Promise<ProjectDocument[]>`：返回首项原系统及新增空白成员。
- `createProjectGroupWithSystems` 与转组共用 `runGroupWrite`，通过 trackWrite 追踪，并在真实 complete/abort 之后结算；超时只请求 abort，不能提前放行重试。

### 3. 数据契约
来源必须在 projects/projectGroups/projectSummaries 同一 readwrite 事务内现读；原 ID、createdAt、profile、categories、assets/检查项/图片引用保留，图片 store 和 `${projectId}:${imageId}` 键不移动。新成员用表单已加载的分类模板和原系统 profile，assets 为空；组与全部摘要一并写入。UI 的 creationType 不入库，真实归属仍看 groupId，单成员组也须建组。

### 4. 校验与错误矩阵
缺失/坏结构/已归档/已有组/updatedAt 不匹配、无两个不同名称或单位必填未满足均拒绝；put 抛错、实际 abort/受控超时中止全部回滚。并发同源提交只能成功一次。提交后刷新失败只重读定位，不重复创建。

### 5. 正常与边界
“财务 系统”只改名；“财务系统、审计系统”转组，首名仍为原系统。组选中时只有一个名称也建真实组；单系统输入多个名称则保留输入并提示改选组。

### 6. 必须验证
`node scripts/verify-project-list-ui.mjs --system-groups` 在隔离 Web/Electron 覆盖全部证据/图片字节、失败与并发、重载、原生 radio/Tab 闭环、连续引导→单成员组→带证据转组→采集快照→ZIP/加密包导出导入→图片解码→灰色示例。另跑 pending-writes、image-store、merge-import、archive-model/flow 与列表原回归。

### 7. 反例
错误：只保存含逗号的名称、删原系统再创建、在事务外先读后改或按包装 Promise 超时认定未提交。正确：显式意图、现读现改、保留原键、同事务摘要及真实终态结算；原单系统包仍不携带组归属。

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

## 桌面数据目录重连与迁移契约

### 1. 范围与触发

`electron/dataLocation.cjs`、正式 main/preload 和存储设置；处理自定义数据目录改名、移动、指针损坏及迁移。Web IndexedDB 路径和数据库 schema 不变。路径恢复只能连接现存数据库，不能从脱离索引的图片文件推测系统结构。

### 2. 接口

- `init(): void`：ready 前读取指针和处理待操作，记录 `recoveryRequired`。
- `needsLocationRecovery(): boolean`、`recoverMissingLocation(): Promise<boolean>`：ready 后、创建任何工作台窗口前定位原目录；false 或异常必须退出。
- `chooseLocation(window): Promise<DataLocationChangeResult>`：选中目录本身有非空 `IndexedDB` 时返回 `mode: 'connect'`；普通父目录使用 `mode: 'migrate'`，目标为其下 `证据采集数据`。
- `resetLocation(): DataLocationChangeResult`：执行相同迁移目标检查。

### 3. 数据与跨层契约

- `%APPDATA%/picture_ocr/data-location.json` 固定在默认位置；`dataDir`、`migration.from/to` 必须为绝对路径，`migration.mode` 允许省略（旧迁移）、`migrate` 或 `connect`。
- `DataLocationChangeResult = { changed, mode?, dataDir?, needRestart?, reason?, error? }` 经 `window.evidenceData` 透传。运行中只写待操作标记；重启且 store 未打开时执行。
- 重连只更新指针，同时设置 `userData` 和 `sessionData`，不复制数据库文件。已有 `backup` 设置 `preserve: true`；UI 显示保留状态，过期清理跳过它。
- 目录识别仅确认 `IndexedDB` 非空，不代表其中项目完整或数据库健康。由用户选择真实目录本身，不扫描候选或根据目录名、唯一子目录猜测归属。
- 指针写入使用同目录临时文件再 rename；写入失败不解除启动阻塞。权限检查仅 stat/access，不创建缺失路径。

### 4. 校验与错误矩阵

| 情况 | 行为 |
| --- | --- |
| 无配置、正常首次启动 | 使用默认位置 |
| 配置损坏、自定义路径失效或无 IndexedDB | 在工作台创建前要求定位；不回落到默认空库 |
| 取消、选错目录、权限/配置保存失败 | 退出；不打开工作台、不改写原库 |
| 待直连目录在重启前消失 | 重新要求定位，不能回落默认库 |
| 选择包含已有库的父目录 | 不自动连接其子目录；目标已占用则拒绝迁移，提示选择原目录本身 |
| 迁移源失效、源目标互相包含 | 拒绝复制 |
| 目标有非缓存文件，包括另一套数据库 | 选择时及启动复制前均拒绝合并覆盖 |
| 备份等于或包含正在使用的目录 | 任何备份删除不得删除当前库 |

### 5. 正常与边界例

原目录改名后启动要求选择新路径，项目及图片沿同一数据库读取；再次启动使用持久指针。旧版已建出有效空库时不能仅凭库为空判断路径归属，由用户在存储设置中直接选择真实原目录并重启。项目文档已经缺失时，重连不承诺恢复它。

### 6. 必需测试

`npm run verify:data-location` 覆盖目录失效不创建、取消/无效/权限/写配置失败、直连、冲突、源消失、嵌套及备份保护。`npm run build` 后运行 `node scripts/verify-data-location-electron.mjs`：用临时目录和合成原生 IndexedDB，退出后真实重命名，经正式 main/preload 断言定位期间 windowCount=0、原系统显示、图片解码显示、内容保持、持久指针与空库直连。禁止把用户真实材料做成测试夹具或提交。

### 7. 错误与正确

错误：在权限检查中递归创建旧路径，异常后继续打开默认空库，或把两套 LevelDB 目录合并复制。正确：检查已有路径，恢复成功后才创建窗口；重连只改指针，迁移前拒绝占用目标。

## 恢复数据交付校验

- 恢复时分别校验系统文档的分类/检查项/profile、本机 `settings.defaultPreset` 和 `projectGroups`/文档 `groupId`；标准单系统 ZIP 不携带本机默认预设或项目组归属，导入成功不等于三者全部恢复。
- 重建隔离恢复库时，无默认记录会回退通用模板。已确认需要等保默认时，从幸存且可识别的旧文档提取预设，经 `saveDefaultPreset` 保存；不把单位、资产和图片带入预设，不改写已有系统模板。
- 缺少原文档的图片只按原系统 ID 保持分隔，临时名称和待整理图片结构必须明示。原组记录及成员关系缺失时，独立列表只是临时呈现，不能认定原来就是独立系统；须有原记录或用户确认的对应关系再重建，不按图片数量猜分组。
- 原资料包与用户正式库不写入；证据检查使用独立只读入口和隔离副本，正式应用验证只在副本上进行。交付 ZIP 完整性校验后，从该 ZIP 解压的库实际打开系统并解码图片，再重启验证默认预设、单位必填和同组多系统新建，确认原恢复文档与图片不变。
- 真实资料、恢复包和运行时证据仅留在忽略的本地目录，不进入 Git 或公开 Release。

## 反模式

- 不为前端任务引入服务端数据库假设或 ORM。
- 不用 `getAll()` 全量读 `projects`（图片可能仍内联，大库会卡死/OOM）；列表与统计只读摘要，占用统计用 `measureProjectImages` 游标逐条累加。
- 不把无关应用状态放进 IndexedDB；提醒阈值、占用统计缓存等本机偏好放 localStorage（`evidence-storage-reminder-v1`、`evidence-storage-stats-v1`）。
