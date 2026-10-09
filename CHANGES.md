# 修改记录 — Picture OCR

## 2026-10-09 — 分类默认测评命令与紧凑复制界面

- 同一项目分类可一次设置默认平台，已有和新增资产按受控检查项用途继承命令；支持单台平台覆盖及恢复分类默认，不根据服务器名称猜操作系统。
- 手动关联优先于自动默认，清空后刷新仍为空，可显式恢复自动默认。配置使用独立本机存储与既有跨窗口写锁，不改项目文档、图片引用或数据库 schema。
- 检查项命令默认折叠，无命令直接打开选择界面；复制反馈靠近操作位置。搜索直接显示匹配命令，搜索时不提供整组复制；命令库编辑、删除收纳到管理模式。
- 主要实现：`assessmentCommandDefaults.ts`、关联存储与共享 hook、命令弹窗和行内面板、`ContentArea.tsx` / `ItemCard.tsx` 局部接线；纯行为和隔离浏览器测试、README 与前端契约同步更新。
- 检查项必填标记、标题、命令入口及同行操作垂直居中；编辑器按编辑对象保留执行环境提示，不受其他窗口改变搜索结果影响。
- 最新验证：生产构建、命令纯行为五组（四类 12 平台）、检查项交互及 375/768/1280px 局部布局通过。扩展的 Web/Electron 十台资产继承、平台隔离与单台例外场景通过；早期全套通过记录不代表最终版本全绿，详见任务 `validation.md`。
- 已知问题：非安全 LAN HTTP 双窗口并发测试出现“两个页面新增的关联都保留”断言失败，尚未确认属于同步时序还是丢写。暂避免多窗口同时编辑命令或关联；用户批准保留该问题并构建此版本。未读取真实客户项目，未在目标设备执行命令。

## 2026-10-09 — 测评命令与检查项关联

- 资产页提供“测评命令”，内置网络设备、安全设备、服务器和数据库共 12 个平台、138 段核查命令；支持搜索、单段/分组复制、新增、编辑与删除。
- 检查项标题旁可展开关联命令，就地查看和复制；共享命令库的编辑同步更新显示，删除后提示失效引用。关联按项目、资产和检查项 ID 隔离，刷新、重命名及排序后保留。
- 命令正文与版本、权限及操作说明分开；复制不可用时提供完整选中文本。保存失败保留草稿，损坏存储暂停写入。跨窗口写入串行处理，拒绝同命令的过期修改。
- 辅助命令库和关联本机保存，桌面版与 Web 版各自独立，不随项目包或预设导出；使用独立辅助 IDB 事务互斥，不更改项目证据数据库 schema。
- 实现位于新增命令目录、存储/互斥工具、共享 hook、命令弹窗与行内面板；资产页和检查项卡片做局部接线。README、前端契约及命令/检查项回归脚本同步更新。
- 验证：生产构建、命令纯行为、Chrome/Electron/非安全 LAN HTTP 真实复制与双页面并发保存、三档布局、检查项交互/鼠标触摸排序、预设兼容、未完成写入保护及差异检查通过。独立 `trellis-check` 未发现阻塞问题，详细证据见 `.trellis/tasks/10-09-assessment-command-copy/validation.md`。
- 命令做过资料与复制核对，未在所有目标设备/数据库版本逐条执行；当前交付本地源码与构建供界面验收。

## 2026-09-30 — 发布 v0.10.0

- 版本号升至 0.10.0，`RELEASE-NOTES.md` 改写为通用化版本的用户说明（含等保老用户另存预设步骤与启动器改名）。
- 修正 `scripts/storage-stats-cases.mjs`：通用模板不再预置资产，夹具改为自行创建带检查项的资产。
- 验证：`npm run build`、`desktop:build`（exe 版本 0.10.0）、21 个 `verify:*` 脚本及 `verify-presets.mjs`、`verify-presets-ui.mjs` 全部退出码 0。
- 清理 `.trellis/.runtime/` 下的临时验证日志与截图，以及真实数据副本 `E:\tmp\picture-ocr-realdata`。

## 2026-09-30 — 程序外壳去掉「测评」字样

### 背景与目标
- 通用化后程序名、窗口标题、PWA 名称和启动器仍带「测评」，统一改为「证据采集工具」。

### 影响与兼容性
- 桌面版数据目录由包名 `picture_ocr` 决定（打包后的 package.json 不含 productName），改 `productName` 只影响 exe、安装包显示名与快捷方式，`%APPDATA%\picture_ocr` 不变。
- 新选择的自定义数据位置子目录改为 `证据采集数据`；已迁移到 `测评证据采集数据` 的用户继续使用原目录，备份删除仍识别旧名。
- Web 版启动器改名为 `启动证据采集工具.bat`，端口与 origin 不变，浏览器数据不受影响。

### 文件与实现
| 操作 | 路径 | 说明 |
|---|---|---|
| 修改 | `package.json`、`electron/main.cjs`、`public/manifest.webmanifest` | productName/description、窗口标题、PWA 名称与描述。 |
| 修改 | `electron/dataLocation.cjs`、`scripts/verify-data-location.cjs` | 新子目录名、旧子目录备份删除兼容及回归断言。 |
| 重命名/修改 | `启动证据采集工具.bat`、`.github/workflows/release.yml`、`README.md`、`RELEASE-NOTES.md` | 启动器文件名与发布标题同步。 |

### 验证
- `npm run desktop:build`、`verify:data-location`（31/31）、`verify:pwa-build`、`verify:web-lan-server`、`verify-presets.mjs` 通过。
- 真实数据副本：复制 `%APPDATA%\picture_ocr` 与 Chrome `127.0.0.1:51730` 的 IndexedDB 到 `E:\tmp\picture-ocr-realdata`，新 exe 与新构建 Web 版分别读取：桌面 1 项目/22 资产/226 张图、Web 1 项目/11 资产/8 张图全部存在并解码成功；原目录前后 md5 一致。

## 2026-09-30 — 通用证据采集模板与项目预设

### 背景与目标
- 将新项目从固定等保内容改为通用证据采集模板：默认只有“通用分类”和可选“截图”检查项，不再生成示例资产。
- 增加可导入、导出和恢复的 JSON 预设；等保分类、检查项、报告标题、文件名前缀及单位字段配置由运行时预设提供。
- 让每个项目保存自己的模板配置和报告配置，驱动项目表单、DOCX、ZIP、加密包及归档兼容流程。

### 影响与兼容性
- 新增 IndexedDB `settings` store 保存默认预设，数据库版本升至 6；升级回调只创建缺失 store/index，不遍历既有数据。Web 与桌面版按 origin/userData 隔离，需要分别导入预设。
- 旧项目没有 `profile` 时使用固定兼容配置：报告标题和导出前缀为通用值，单位名称保持必填；覆盖导入可采用数据包配置，合并导入保留目标项目配置。
- 等保文件 `presets/dengbao.json` 仅作为本地运行时导入文件并被 `.gitignore` 排除，不进入构建产物；应用标识、桌面数据位置和真实用户库未改变。

### 文件与实现
| 操作 | 路径 | 说明 |
|---|---|---|
| 新增/修改 | `src/types/index.ts`、`src/utils/preset.ts`、`src/data/defaults.ts` | 增加 `ProjectProfile`/`ProjectPreset`、运行时校验、深拷贝、文件名净化和通用默认内容。 |
| 修改 | `src/utils/db.ts`、`src/context/appReducer.ts`、`src/context/AppContext.tsx` | 持久化默认预设；项目/项目组创建、加载、摘要和保存链路保留项目配置；新增分类及改名 action。 |
| 新增/修改 | `src/components/project-list/PresetDialog.tsx`、`ProjectList.tsx`、`ProjectInfoDialog.tsx`、`ProjectGroupDialog.tsx`、`Sidebar.tsx` | 增加预设管理、报告配置、动态单位字段校验、分类管理和旧项目配置展示。 |
| 修改 | `src/utils/wordDocument.ts`、`src/utils/wordExport.ts`、`src/utils/exportImport.ts`、`src/utils/archiveFormat.ts`、`src/components/MobileCollector.tsx` | DOCX/ZIP/加密包/归档透传项目 profile，并兼容旧数据包。 |
| 新增/修改 | `scripts/verify-presets.mjs`、归档/图片/项目列表验证脚本、`README.md` | 增加模型和双端 UI 回归，修正通用初始数据及测试夹具。 |

### 验证
- `npm run build`：生产构建通过，生成 12 项 PWA 预缓存资源。
- `node scripts/verify-presets.mjs`：9 组通过，覆盖通用新建、预设深拷贝、旧项目兼容、分类 action、命名净化、JSON 拒绝规则、文本长度与跨分类重复 ID。
- `node scripts/verify-presets-ui.mjs`：Web/Electron 各 7 组通过，包括原生 IDB、ZIP/加密包/DOCX、分类增改、另存再导入、配置保存失败/重试/重开，以及三档宽度；截图已检查，无新增解释小字。
- `node scripts/verify-project-list-views.mjs`、`node scripts/verify-project-list-ui.mjs`：纯逻辑通过；Web 19 组、Electron 18 组真实浏览器流程通过，覆盖列表读路径、创建/编辑/导入导出、采集范围、键盘焦点和 375/768/1440px 布局。
- `verify:summary-repair`、`verify:list-summary-store`、`verify:image-store`、`verify:archive-model`、`verify:archive-format`、`verify:archive-flow`、`verify:evidence-package`、`verify:lan-mobile-picker`、`verify:data-location`、`verify:pwa-build`：串行回归通过；加强后的归档 flow 双端 110 条检查通过，含配置归档/恢复。`git diff --check` 通过。完整证据见任务 `verification.md`。

### 已知限制与后续
- 预设导入只影响之后新建的项目，已有项目不会批量改模板；桌面版与 Web ZIP 不能共享 IndexedDB 预设。
- 验证仅使用隔离 Web/Electron 环境；未制作新版安装包、未发布，未操作用户真实数据。Word 验证针对生成的 DOCX XML 和属性，未人工打开 Microsoft Word。


## 2026-09-16 — 局域网采集后台恢复、名称与拍照入口

### 背景与目标
- 修复暂停/网络中断后手机未继续核对的问题：恢复前台或网络时查询原请求；仅电脑暂停而手机保持前台时，未确认状态每 5 秒只读核对。保存已完成才清除原图，自动恢复不重发图片。
- 采集快照读取真实项目组名称，工作台和列表保存改名后更新同一会话；修复重复“未启动”通知取消首次快照的竞态。
- 普通局域网 HTTP 或缺少网页相机 API 时，点击拍照直接激活系统相机 input；支持网页相机的环境保留预览与权限失败后的人工回退。

### 影响与兼容性
- Web 与 Electron 共用前端修复，不改服务协议、数据库、固定 Web 端口、生产超时或电源策略，无新依赖。回退仅涉及本次前端和验证文件，不清库。
- 自动状态核对与手动上传互斥；保留原编号、原目标、原图及既有真实落库确认。页面被关闭/回收后仍不保证恢复。

### 文件与实现
| 操作 | 路径 | 说明 |
|---|---|---|
| 修改 | `src/components/LanMobileCollector.tsx`、`src/utils/lanUpload.ts` | 合并恢复事件、单次只读核对、未确认低频查询及取消清理；相机能力路由和提示。 |
| 修改 | `src/App.tsx`、`src/components/ProjectList.tsx`、`src/utils/lanGroupSnapshot.ts` | 权威组名、保存回调、构建代际和初始化状态去重。 |
| 新增/修改 | `scripts/lan-lifecycle-ui-cases.mjs`、`verify-lan-group-snapshot.mjs`、`verify-lan-upload-ui.mjs`、`verify-lan-mobile-recovery.mjs`、项目列表测试辅助文件 | 真实双端恢复/名称/相机回归；生命周期测试保留正式后台节流。 |
| 修改/新增 | `.trellis/spec/`、`.trellis/tasks/09-16-lan-collector-regressions/` | 契约、测试盲区、规划与验证记录。 |

### 验证
- `npm run build`、`verify-lan-upload-ui.mjs --lifecycle`：双端共 22 项通过；覆盖手机暂停、仅电脑暂停、双方暂停及两种恢复顺序，照片引用和字节各一条且无额外 POST。
- `verify-lan-upload-ui.mjs` 原双端回归通过；名称单元与 UI、权限拒绝/预览释放/取消、375/768/1440px、44px 按钮及真实 Enter 通过。
- `verify-project-list-ui.mjs` 最终 Web 19 / Electron 18 项通过；首轮发现的快照初始化竞态已修复复验。
- 连接、上传协议、截止时间、手机恢复、图片事务、LAN 双端服务、存储/压缩、关闭保护、错误报告、列表派生逻辑、PWA 与差异检查通过。完整命令和证据见任务 `verification.md`。

### 已知限制与后续
- 暂停由 CDP 冻结/解冻和网络故障模拟，未做 Windows 自动锁屏或手机原生相机实测，不能将其视作现场全部根因已确认。普通 HTTP 的系统来源弹窗由手机决定。
- 通用空连接关闭日志不能证明某张照片上传失败；本次未隐藏日志、修改系统睡眠设置或接触真实用户数据。
- 用户已批准以 v0.8.3 提交、推送并触发双端 Release；集中真机验收步骤已写入任务验证记录。

## 2026-09-15 — 手机局域网上传卡住与安全恢复

### 背景与目标
- 隔离复现了 Web PowerShell 服务被空闲 TCP 连接拖住的问题。改为有界异步收发；手机分别显示处理、上传和等待保存，超时后保留当前照片及原目标，允许核对、重试和下载原图。
- 两端使用固定上传编号及服务端内容指纹，回执丢失后核对原请求，不重复入库；真实保存失败后允许人工重试。

### 影响与兼容性
- Web ZIP 与 Electron 同步更新上传、状态查询及保存回执。快照增加可选 `uploadRecovery: 1`；兼容无编号旧客户端，新客户端遇到旧宿主不承诺安全重试。
- `addImageToProject` 超时请求 abort，以实际 complete/abort 结算并释放关闭保护；其他 DB 路径不顺手重构。保持来源端口 51730、数据库版本和现有三 store 结构，无数据迁移或新依赖。
- 用户已授权提交、推送并发布 v0.8.2；版本号、锁文件与发布说明同步更新。回退应整体回退关联协议及前端修改，不清空用户库。

### 文件与实现
| 操作 | 路径 | 说明 |
|---|---|---|
| 修改 | `start-server.ps1` | 内嵌 C# 异步收发、连接与总时限边界、稳定编号及状态、幂等确认和脱敏日志。 |
| 修改 | `electron/lanServer.cjs`、`electron/main.cjs` | 同 id 内容/目标校验、202/状态查询、保留真实保存回执关联，按会话/尝试隔离。 |
| 新增/修改 | `src/utils/asyncDeadline.ts`、`lanUpload.ts`、`lanBridge.ts`、`src/vite-env.d.ts`、`src/App.tsx` | 含响应体的超时、前台恢复检查、固定身份、桥接超时/代际、请求与目标错误记录。 |
| 修改 | `src/components/LanMobileCollector.tsx`、`src/utils/imageCompression.ts`、`src/utils/db.ts` | 单图恢复操作、原图生命周期、解码挂起回退与迟到资源释放、真实事务终态保护。 |
| 新增/修改 | `scripts/verify-web-lan-connections.mjs`、`verify-lan-upload-recovery.mjs`、`verify-lan-deadlines.mjs`、`verify-lan-mobile-recovery.mjs`、`verify-lan-write-lifecycle.mjs`、`verify-lan-upload-ui.mjs` 及测试辅助文件 | 实际协议、网络故障、事务生命周期和隔离双端浏览器验证；更新旧源码定位断言。 |
| 修改/新增 | `.trellis/spec/backend/`、前端状态/质量规范、任务目录 | 新协议与真实证据，修正 backend 索引过时的纯浏览器描述。 |

### 验证
- RED：旧服务空闲连接使控制请求超时；旧协议未声明 recovery 能力；事务测试捕获包装超时提前释放。对应回归现已通过。
- `node scripts/verify-web-lan-connections.mjs`：空闲、半头、半正文、reset、慢读、非法 framing、头/正文总时限与 32 连接容量通过。
- `node scripts/verify-lan-upload-recovery.mjs`：Web/Electron 同编号去重、内容/目标冲突、失败重试、重复/迟到回执和 8 张队列通过。
- `verify-lan-deadlines.mjs`、`verify-lan-mobile-recovery.mjs`、`verify-lan-write-lifecycle.mjs`：响应体挂起、后台恢复、原图与目标保留、旧宿主/会话失效、真实事务终态和 pending 保护通过。
- `npm run build` 与 `node scripts/verify-lan-upload-ui.mjs`：真实 PowerShell + Chrome、正式 Electron + 临时 userData，各 7 组通过。验证上传响应丢失、Web 确认响应丢失、实际 IDB 写路径失败、实际提交但完成事件延迟、解码挂起与迟到 bitmap 释放、token 切换隔离及卸载原图 URL 释放；核对引用及字节条数。375/768/1440px、44px 按钮和真实 Enter 通过。
- 现有 `verify:lan-server`、`verify:web-lan-server`、`verify:lan-mobile-picker`、`verify:lan-image-sink`、`verify:image-compression`、`verify:image-store`（76/76）、`verify:pending-writes`（29/29）、`verify:error-report`（19/19）、`verify:pwa-build` 通过。

### 已知限制与后续
- 未接触现场真实库，无法据此判断或找回此前卡住的具体照片；没有实测手机、热点、系统相机权限或浏览器被回收。
- 原图仅保留在当前页面内存，刷新/关闭前需自行保存原图；未增加离线队列。
- 网络正文/发送预算仅在隔离副本缩短；本机慢读响应被 OS 缓冲完整接收，验证了不阻塞控制，未声称该次触发了发送截止时间。重试与保存故障为明确标注的受控注入。
- 截图与 JSON 报告在 `.trellis/.runtime/lan-upload-qa/`；完整验收映射见任务 `verification.md`。

## 2026-09-14 — 多系统项目恢复原地展开与收起

### 背景与目标
- 保留「多系统项目／独立系统」页签，项目名称和箭头直接展开组内系统，支持同时展开多个项目，取消进入详情再返回的步骤。
- 保留去除重复分类标题的修正；项目采用清晰的标题栏，44px 展开区域和 20px 箭头，单位/系统总数/更新时间集中展示。组内系统有独立对齐表头，减少重复单位，保留不同单位；全选并入表头，仅选中后显示删除，减少空白工具栏。

### 影响与兼容性
- App 保存普通/搜索期间两套展开状态及每页签搜索、滚动。首次全展开；空数组代表全部收起，刷新不会重置。搜索项目字段展示全组，搜索系统字段只展示匹配系统，清除搜索恢复原展开状态。
- 批量选择只属于一个项目；切组选择替换前组，收起、切页和搜索清空选择。组级手机采集始终包含完整项目，系统级仅包含所选系统。
- 新建或添加保存成功后展开并定位新增系统；保存成功但摘要刷新失败保留原位置，重试成功再定位，不重复创建。数据库、系统归属、工作区 URL 及图片读取方式不变。

### 文件与实现
| 操作 | 路径 | 说明 |
|---|---|---|
| 修改 | `src/App.tsx`、`src/components/ProjectList.tsx`、`src/components/project-list/projectListViews.ts`、`projectListUi.ts` | 展开状态、分类搜索、单组选择、公共系统行、项目与系统布局及一次性新增定位。 |
| 修改 | `scripts/verify-project-list-views.mjs`、`scripts/project-list-browser-cases.mjs`、`scripts/verify-project-list-ui.mjs`、`scripts/project-list-electron.cjs` | 替换详情导航断言，补充展开、故障和键盘回归；CDP 超时及断连处理，隔离桌面禁用后台计时器节流。 |
| 修改 | `.trellis/spec/frontend/`、本任务目录 | 更新原地展开与选择/搜索契约、验证记录。 |

### 验证
- 纯逻辑 RED：新增 `filterGroupSystems` 缺失而失败；浏览器 RED：旧生产构建因不支持初次原地全展开而失败。
- `node scripts/verify-project-list-views.mjs`、`npm run build`、`npm run verify:pwa-build` 通过。
- `node scripts/verify-project-list-ui.mjs` 最终一次完整运行：网页端 19 组、Electron 18 组通过；375/768/1440px 独立/展开列表截图及菜单边界通过，真实 Enter/Space/Tab/Escape、焦点恢复通过。
- 截图反馈后的布局修订：双端仍为 Web 19 / Electron 18 组全绿；增加长中文项目/系统名、不同单位保留、箭头/点击区域尺寸、表头列对齐与资产数不换行断言，人工查看更新后的桌面和窄屏截图。最终日志 `.trellis/.runtime/project-group-layout-final.log`。
- `verify:lan-mobile-picker`、`verify:list-summary-store`（24/24）、`verify:summary-repair`（44/44）、`verify:pending-writes`（29/29）、`verify:evidence-package` 和 `git diff --check` 通过。

### 已知限制与后续
- 使用合成数据和隔离 profile/userData；Electron 正式 main/preload 加载生产 dist，未生成安装器。Web control 与保存/加载故障为受控模拟，不代表真实手机/Wi-Fi 或客户数据验收。
- 桌面自动化曾因窗口遮挡的后台计时器节流超时；仅隔离测试入口禁用节流，应用代码不变。CDP 断连后不再无限等待截图。
- 本次未提交或发布，待提交确认；回退只需回退展示、状态与测试改动，保留标题去重修正，不需要数据回滚。

## 2026-09-14 — v0.8.0 项目组与独立系统分开展示

### 背景与目标
- 项目管理中心分为「多系统项目」「独立系统」，进入项目后只显示该项目的系统，减少混排和行内按钮拥挤。

### 影响与兼容性
- 按项目组归属分类：一个系统的组、空组仍在项目页；缺组记录保留异常入口。数据库、系统归属及工作区 URL 不变，列表继续只读摘要。
- App 保存页签、组、搜索和滚动位置；切换范围清空选择，批量删除只取当前可见系统。新建成功自动定位结果，加载失败可重试。
- 系统与项目组低频操作统一收纳，窄屏采集入口放进更多；键盘、焦点与窗口边界处理一致。

### 文件与实现
| 操作 | 路径 | 说明 |
|---|---|---|
| 修改 | `src/App.tsx`、`src/components/ProjectList.tsx` | 跨重挂载保存列表位置，分开项目/系统导航、搜索、选择和创建落点。 |
| 新增/修改 | `src/components/project-list/ProjectActions.tsx`、`projectListViews.ts`、`ProjectListHeader.tsx`、`projectListUi.ts` | 纯派生分类、共享网格、更多菜单与语义入口。 |
| 新增/修改 | `scripts/verify-project-list-views.mjs`、`verify-project-list-ui.mjs`、`project-list-browser-cases.mjs`、`project-list-electron.cjs`、`verify-lan-mobile-picker.mjs` | 真实分类测试、双端隔离交互、采集范围和旧布局断言更新。 |
| 修改 | `.trellis/spec/frontend/`、本任务目录 | 记录分类/恢复/选择契约、菜单首次展开定位问题和执行证据。 |

### 验证
- 新增分类测试通过；生产 Chrome 14 组、Electron 13 组 UI 回归通过：分类/异常组、搜索与选择、创建/编辑/删除、ZIP 导出与合并/覆盖导入、加载/保存失败、导航与滚动、默认页签、采集目标和上传计数。
- 375/768/1440px 无横向溢出；真实 Enter/Tab/Escape 和焦点恢复、底部向上展开均通过。回归发现首次展开菜单占流导致定位偏移，修复初始固定定位后双端全绿。
- 既有摘要读取 24/24、自检修复 44/44、图片 store 76/76、pending-writes 29/29，以及图片压缩、采集 UI、加密数据包、PWA 检查通过；`npm run build` 和 `git diff --check` 通过。

### 验证边界与交付状态
- 使用合成数据与临时 profile/userData，未接触用户真实库。Electron 运行正式 main/preload 加载生产 dist，未生成安装器；Web 采集 HTTP control、保存/加载失败是受控夹具，不代替真实手机/Wi-Fi 验收。
- 分类 RED 为真实 helper 缺失；旧浏览器混排由源码确认，未运行旧构建浏览器 RED。外部删除用例避开原系统卸载 flushSave，不覆盖跨窗口自动保存冲突。
- 发布检查补充通过：v0.8.0 生产构建、Electron LAN 服务、Web ZIP PowerShell 宿主、检查项交互与真实 Pointer 拖拽、数据目录迁移 29/29、存储估算 9/9、PWA。
- 用户已批准提交、推送和 Release；package.json、锁文件与人工发布说明统一为 v0.8.0，使用 `picture-ocr-v0.8.0` 标签触发现有发布工作流。

## 2026-09-11 — 异常文档只读诊断与迁移判定

### 背景与目标
- 修复 null/非法文档被图片迁移记为完成、对账误报一致；诊断增加异常主键关联的独立图片条数及迁移状态。

### 影响与兼容性
- Web/Electron 共用数据库逻辑，DB_VERSION=5、store 与图片格式不变；诊断只读且不建库/升级，不触发摘要修复。
- 图片计数失败为 null，明确区分缺库、不支持和错误；数量不等于可恢复图片数。旧 completed 中已知异常可重新检查。

### 文件与实现
| 操作 | 路径 | 说明 |
|---|---|---|
| 修改 | `src/utils/db.ts`、`src/utils/errorLog.ts` | 只读诊断连接及事务生命周期、关联计数、迁移状态与对账校验。 |
| 新增 | `scripts/verify-null-record-diagnosis.mjs`、`scripts/diagnosis-browser-cases.mjs`、`scripts/diagnosis-electron.cjs` | 隔离 Chrome/Electron 原生 IDB 与受控异常模拟回归。 |
| 修改 | `scripts/verify-summary-repair.mjs`、`.trellis/spec/frontend/state-management.md`、任务目录 | 更新报告引用契约断言、存储规范、审批与执行记录。 |

### 验证
- 新增回归两端各 32 项通过（含主会话补充的历史异常进度误判 RED/GREEN）；既有 summary-repair 44/44、error-report 19/19、image-store 76/76、data-location 29/29、list-summary-store 24/24、pending-writes 29/29。
- `npm run build` 与 `git diff --check` 通过。

### 已知限制与后续
- null/非法返回、错误事件和超时为受控模拟，正常路径使用真实 IndexedDB；Electron 为隔离测试入口，不是完整打包应用 UI 验收。
- 不接触客户真实库，不代表远程损坏复现或数据恢复；恢复仍需数据库副本或故障前备份。本任务不提交或发布。

## 2026-07-23 — v0.4.4 检查项排序与操作优化

### 背景与目标
- 让手动新增检查项的默认必填状态和插入位置明确，并移除无功能操作入口。
- 提供独立、安全且可连续调整长列表的检查项排序体验，避免触屏环境将普通滑动或编辑误识别为排序。

### 影响与兼容性
- 手动新增检查项默认必填并插入当前资产首位；既有项目数据结构与 IndexedDB 文档无需迁移。
- 排序仅在显式“调整顺序”模式中由专用六点手柄发起；拖动时实时预览、悬浮副本与边缘自动滚动均是页面瞬时状态，松手后才经 reducer 持久化，取消会还原。
- Web 静态版与 Electron 客户端共用同一 React 渲染代码；自动化以生产预览验证 Pointer Events，并额外核验 Windows Electron 目录包包含当前前端资源。

### 文件与实现
| 操作 | 路径 | 说明 |
|---|---|---|
| 修改 | `src/context/appReducer.ts` | 新增完整检查项顺序校验与重排 action；新增项默认必填并置顶。 |
| 修改 | `src/components/ContentArea.tsx`、`src/components/ItemCard.tsx` | 实现隔离的排序模式、鼠标/触摸拖拽实时预览、FLIP 让位动画、边缘自动滚动及普通操作恢复。 |
| 新增 | `scripts/verify-inspection-item-interactions.mjs`、`scripts/verify-inspection-item-pointer-drag.mjs` | 覆盖 reducer 契约与生产浏览器中的鼠标/触摸拖拽、取消还原、边缘自动滚动。 |
| 修改 | `README.md`、`.github/workflows/release-picture-ocr.yml`、`.gitignore` | 更新使用、验证、发行说明和本地构建产物忽略规则。 |
| 修改 | `.trellis/spec/frontend/*.md`、`.trellis/tasks/07-23-inspection-item-interactions/` | 记录排序数据、rAF 生命周期和任务设计/验证证据。 |

### 验证
- `node scripts/verify-inspection-item-interactions.mjs`、`node scripts/verify-inspection-item-pointer-drag.mjs`：通过新增默认值、完整排序 payload、鼠标/触摸实时拖拽、取消还原和边缘自动滚动验证。
- `npm run verify:evidence-package`、`npm run verify:lan-server`、`npm run verify:lan-mobile-picker`、`npm run verify:web-lan-server`、`npm run verify:pwa-build`、`npm run build`：通过既有完整 Web/PWA 基线。
- 临时输出目录的 Electron `--win --dir` 打包通过，且已核验 `app.asar` 包含实时排序和边缘自动滚动前端代码。

### 已知限制与后续
- 工作区默认 `desktop-dist/` 在本机被 Windows 占用时，`npm run desktop:build` 可能在目录重命名阶段出现 `EPERM`；切换到临时输出目录可完成等价的目录包验证。
- 自动滚动速度按帧计算（单帧最大 18px）；高刷新率设备上的每秒速度会更快，如需跨刷新率严格一致可改为基于时间戳计算。


## 2026-07-21 — v0.4.3 实时会话同步与手机网页相机

### 背景与目标
- 让手机局域网采集在电脑端编辑资产或检查项后保持同一会话并自动更新，避免重新扫码。
- 改善不同手机浏览器的图片来源体验：保留系统选择，并提供可记忆的“拍照 / 相册分开选择”和网页相机预览路径。

### 影响与兼容性
- 项目工作台是唯一的局域网采集入口；关闭二维码窗口只收起界面，工具栏“采集中”状态可重新打开会话信息，停止会话才会失效。
- Electron 与 Web ZIP 会话可原子更新同项目快照和上传白名单；手机每 2 秒同步最新结构。删除的目标立即拒绝上传，新增目标无需重新扫码即可出现。
- 手机默认使用“系统选择（推荐）”，可将偏好保存到当前浏览器；“拍照 / 相册分开选择”优先尝试网页后置相机预览，失败时仍可使用系统相机或相册回退。
- 网页相机是否可用于局域网 HTTP 地址取决于浏览器安全策略与权限。vivo 自带浏览器可能仍仅提供相册；用户可切换系统选择、使用微信/Chrome 或其他支持的浏览器。
- PC Web 在项目工作台刷新时会从 `#/project/<项目ID>` 恢复当前项目；返回项目列表时清除该路由，不再因刷新退回项目列表。

### 文件与实现
| 操作 | 路径 | 说明 |
|---|---|---|
| 修改 | `electron/lanServer.cjs`、`electron/main.cjs`、`electron/preload.cjs`、`src/vite-env.d.ts` | 支持 Electron 同项目快照与白名单热更新。 |
| 修改 | `start-server.ps1`、`src/utils/lanBridge.ts` | 增加 Web ZIP 受控快照更新端点并统一桥接接口。 |
| 修改 | `src/App.tsx`、`src/components/LanCollectorDialog.tsx`、`src/components/Toolbar.tsx`、`src/components/ProjectList.tsx` | 持续会话状态、项目内唯一入口、桌面项目刷新路由恢复及响应式项目列表修复。 |
| 修改 | `src/components/LanMobileCollector.tsx` | 手机 2 秒结构同步、图片来源方式、网页相机预览、系统相机和相册回退。 |
| 修改 | `scripts/verify-lan-server.cjs`、`scripts/verify-web-lan-server.ps1`、`scripts/verify-lan-mobile-picker.mjs` | 覆盖热更新安全边界、手机来源模式、网页相机资源清理和响应式布局约束。 |
| 修改 | `package.json`、`package-lock.json` | 升级版本至 `0.4.3`。 |

### 验证
- `npm run verify:lan-mobile-picker`、`npm run verify:lan-server`、`npm run verify:web-lan-server`：通过手机交互和 Electron/Web ZIP 会话安全边界验证。
- `npm run verify:evidence-package`、`npm run build`、`npm run verify:pwa-build`：通过数据包、生产构建和 PWA 回归验证。
- `git diff --check`：通过。

### 已知限制与后续
- 尚未在真实 vivo、华为/HarmonyOS、微信和 Chrome 的局域网 HTTP 地址上完成网页相机预览烟测；浏览器可能因安全上下文或厂商策略拒绝网页相机，系统选择和相册回退仍可用。
- 局域网采集仍仅适用于可信同一 Wi-Fi 或个人热点，HTTP 传输不加密。

## 2026-07-21 — 局域网会话热更新与持续采集

### 背景与目标
- 电脑端编辑分类、资产或检查项后，让已扫码的手机采集页自动获得最新结构，不要求重新扫码。
- 将局域网采集限制为项目工作台入口；二维码窗口可收起而不停止采集，并明确展示活动会话状态。

### 影响与兼容性
- Electron 与 Web ZIP 均支持以同一项目 ID 原子替换会话快照和上传白名单；旧资产/检查项的上传会立即被拒绝，避免写入已删除的数据目标。
- 手机端每 2 秒拉取会话快照，保留仍存在的分类和资产选择；当前选择被电脑端删除时自动回退到首个有效选择并提示用户。
- 工作台工具栏在会话存活时显示绿色状态点和“采集中”；右上角 × 仅收起二维码窗口，可通过该状态按钮重新打开。只有明确停止、离开工作台、退出程序或会话超时才会终止。
- 项目列表移除局域网采集入口及其会话逻辑，原有响应式列布局和“更多操作”收纳保持不变。

### 文件与实现
| 操作 | 路径 | 说明 |
|---|---|---|
| 修改 | `electron/lanServer.cjs`、`electron/main.cjs`、`electron/preload.cjs`、`src/vite-env.d.ts` | 为 Electron 会话添加受限的同项目快照/白名单更新 IPC。 |
| 修改 | `start-server.ps1` | 为 Web ZIP loopback 控制端添加受 `X-Evidence-Control` 保护的快照更新端点。 |
| 修改 | `src/utils/lanBridge.ts` | 统一 Electron 与 Web ZIP 的 `updateSession` 桥接接口并串行会话操作。 |
| 修改 | `src/App.tsx`、`src/components/LanCollectorDialog.tsx`、`src/components/Toolbar.tsx` | 推送工作台快照、维护会话状态，支持弹窗收起和“采集中”重开入口。 |
| 修改 | `src/components/LanMobileCollector.tsx` | 每 2 秒同步最新快照、按稳定 ID 保留选择、选择失效时回退，并在页面离开时取消在途刷新请求。 |
| 修改 | `src/components/ProjectList.tsx` | 删除项目外局域网采集入口及重复会话处理。 |
| 修改 | `scripts/verify-lan-server.cjs`、`scripts/verify-web-lan-server.ps1`、`scripts/verify-lan-mobile-picker.mjs` | 覆盖 Electron/Web ZIP 原子更新、新旧白名单边界、手机同步与工作台状态约束。 |
| 新增 | `docs/superpowers/specs/2026-07-21-lan-session-live-sync-design.md`、`docs/superpowers/plans/2026-07-21-lan-session-live-sync-implementation.md` | 记录设计决策和可复现实施计划。 |

### 验证
- `npm run verify:lan-mobile-picker`、`npm run verify:lan-server`、`npm run verify:web-lan-server`：通过前端交互与 Electron/Web ZIP 会话更新安全边界验证。
- `npm run verify:evidence-package`、`npm run build`、`npm run verify:pwa-build`：通过数据包、TypeScript、生产构建和 PWA 回归验证。
- `git diff --check`：通过。

### 已知限制与后续
- 尚未在实际 vivo、iPhone Safari、华为/HarmonyOS 浏览器上执行“扫码后编辑电脑结构、手机自动更新、继续上传”的端到端烟测；系统文件选择器和局域网策略仍需目标设备确认。
- LAN HTTP 传输仍仅适用于可信同一局域网或个人热点；不提供互联网访问、传输加密、账号隔离或多用户协作。

## 2026-07-21 — v0.4.2 手机采集兼容性与响应式项目列表

### 背景与目标
- 改善部分 Android / HarmonyOS 浏览器扫码后仅显示相册的问题，并消除局域网会话对话框中重复的关闭操作。
- 适配 Windows 不同屏幕尺寸与 DPI 缩放下的项目列表，避免操作按钮拥挤或不自然换行。

### 影响与兼容性
- 手机端继续使用单一“拍照 / 选择图片”入口，移除 `capture="environment"` 的相机强制指令，由 Android、iOS 和 HarmonyOS 的浏览器/系统选择器提供可用的拍照或相册选项。
- 图片格式白名单仍为 PNG、JPEG、GIF、WebP 和 BMP，未增加 HEIC；已有服务端校验和 Word 导出行为不变。
- 窄窗口将低频项目操作收纳至“更多操作”，宽屏保留全部快捷操作；不改变项目数据、局域网会话或导入导出协议。

### 文件与实现
| 操作 | 路径 | 说明 |
|---|---|---|
| 修改 | `src/components/LanMobileCollector.tsx` | 移除 `capture="environment"`，保留单一图片选择入口和既有格式限制。 |
| 修改 | `src/components/LanCollectorDialog.tsx` | 移除底部重复“关闭”按钮，保留右上角关闭与明确的会话启停操作。 |
| 修改 | `src/components/ProjectList.tsx` | 为项目表格添加窄/宽屏列布局和低频操作菜单。 |
| 修改 | `src/components/project-list/ProjectListHeader.tsx` | 调整搜索与操作区的自适应换行、间距及触控高度。 |
| 新增 | `scripts/verify-lan-mobile-picker.mjs` | 校验图片入口、对话框操作及响应式布局约束。 |
| 修改 | `package.json`、`package-lock.json` | 升级版本至 `0.4.2` 并登记专项验证命令。 |

### 验证
- `npm run verify:lan-mobile-picker`：通过单一图片入口、取消相机强制、会话操作和响应式布局约束验证。
- `npm run verify:lan-server`、`npm run verify:web-lan-server`、`npm run verify:evidence-package`：通过局域网服务、Web ZIP 会话和数据包回归验证。
- `npm run build`、`npm run verify:pwa-build`：通过 TypeScript、生产构建及 PWA 构建产物验证。
- `git diff --check`：通过。

### 已知限制与后续
- 手机系统文件选择器展示的拍照/相册选项由具体浏览器与系统版本决定，仍需在目标 vivo、iPhone 和华为设备上完成扫码烟测。
- 历史 HEIC 照片仍不在支持范围内；若需支持，应单独实现并验证 HEIC 转 JPEG 的完整上传、校验、存储和报告导出链路。

## 2026-07-20 — Web ZIP 与 Windows 客户端统一手机局域网实时采集

### 背景与目标
- 将原本仅 Electron 客户端可用的“手机局域网采集”扩展至 Web ZIP；两种交付形态均为推荐的实时采集路径。
- 保留既有 Electron 实现和普通 ZIP 数据包导入/导出；`.evidence` 仅保留历史兼容和紧急恢复，不再推荐作为日常流程。

### 影响与兼容性
- `启动测评证据采集工具.bat` 仍启动同一 `start-server.ps1`，但 PowerShell 现作为真正的局域网会话宿主：电脑页面只通过 loopback 控制 API 启停会话，手机只通过随机 token 访问快照、上传白名单图片及查询保存结果。
- 为避免 `HttpListener` URL ACL / 通配符权限问题，Web ZIP 始终先用精确 `TcpListener` 绑定 localhost；仅在用户启动会话时再绑定所选 RFC1918 私有 IPv4，并在停止、切换或超时后释放该监听。未连接 Wi-Fi/热点时不阻断电脑端项目管理，手机采集链接仅在所选私有地址上生效。
- 上传图片只存在 PowerShell 内存待确认队列；浏览器 IndexedDB 成功或失败确认后立即移除。手机先得到 `202`，仅轮询到 `201` 时显示保存成功。
- HTTP 不加密，仍仅限同一可信 Wi-Fi 或可信个人热点；防火墙应仅允许专用网络。

### 文件与实现
| 操作 | 路径 | 说明 |
|---|---|---|
| 修改 | `start-server.ps1` | 从 localhost 静态服务升级为受限控制/手机 API、静态资源边界和内存交付确认的 TCP 宿主。 |
| 新增 | `src/utils/lanBridge.ts` | 统一 Electron 原生桥与 localhost Web 控制桥；Web 使用短轮询交付图片。 |
| 修改 | `src/App.tsx`、`src/components/ProjectList.tsx`、`src/components/LanCollectorDialog.tsx` | Web/Electron 共用可用性检测、项目入口、会话对话框和 IndexedDB 保存确认。 |
| 修改 | `src/components/LanMobileCollector.tsx` | 移动端在电脑端保存确认前保持等待，不提前报告成功。 |
| 新增 | `scripts/verify-web-lan-server.ps1` | Windows PowerShell 验证控制端、token、白名单、类型校验、交付确认、关闭失效和静态边界。 |
| 修改 | `README.md`、`.github/workflows/release-picture-ocr.yml`、`package.json` | 统一推荐流程、Release Notes 和验证命令。 |

### 验证
- `npm run verify:web-lan-server`：通过 Web ZIP 局域网控制、token、白名单、静态边界、上传确认和停止失效验证。
- `npm run build`、`npm run verify:lan-server`、`npm run verify:pwa-build`、`npm run verify:evidence-package`：通过。

### 已知限制与后续
- Web ZIP 只支持 Windows PowerShell 5.1+；没有可用私有 IPv4、被防火墙或企业网络策略阻断时无法建立手机会话，并会显示真实错误。
- 未在真实手机设备上自动化验证；交付前需按 README 在可信同网段完成扫码、拍照、保存确认和会话关闭烟测。

## 2026-07-20 — Windows Electron 手机局域网实时采集

### 背景与目标
- 为 Windows Electron 客户端增加同一可信局域网内的手机实时拍照/选图同步，作为日常手机采集的推荐流程。
- 移除普通项目列表中的“导出加密采集包”入口；普通 ZIP“导出数据包 / 导入数据包”保留。
- `.evidence` 加密离线采集包及历史手机页保留为既有数据兼容、离线场景紧急恢复能力，不再作为推荐的日常手机采集路径。

### 影响与兼容性
- Electron 主进程启动单一临时 HTTP 会话，只暴露带随机令牌的采集快照与白名单图片上传；停止、切换/退出工作台或退出客户端后会话失效。
- 新增 `qrcode` 浏览器依赖，用于离线生成手机访问二维码。
- `.evidence` 格式、Web ZIP、IndexedDB 项目数据结构及既有离线手机入口保持兼容；桌面“导入数据包”继续支持导入 `.evidence`。LAN HTTP 不使用 Web Crypto、PWA 或 Service Worker，传输不加密，只能用于可信同网段。

### 文件与实现
| 操作 | 路径 | 说明 |
|---|---|---|
| 新增 | `electron/lanServer.cjs` | 无 Electron 运行时依赖的令牌认证局域网 HTTP 服务、静态资源限制及上传校验。 |
| 新增 | `electron/preload.cjs` | 仅暴露启动/停止/查询会话与受控图片通知的白名单 IPC。 |
| 修改 | `electron/main.cjs` | 安全桌面壳、局域网接口检测、会话生命周期与渲染器通知。 |
| 新增 | `src/components/LanCollectorDialog.tsx` | Windows 工作台的会话、二维码、网络与防火墙说明对话框。 |
| 新增 | `src/components/LanMobileCollector.tsx` | `#/lan/<token>` 手机只读采集快照、拍照/选图上传界面。 |
| 修改 | `src/App.tsx`、`src/components/ProjectList.tsx`、`src/components/Toolbar.tsx` | Electron 入口、路由、当前项目图片写回和会话关闭；项目列表只保留普通数据包导入/导出与 Electron 局域网采集入口。 |
| 新增 | `scripts/verify-lan-server.cjs` | Node 内置断言验证局域网服务安全边界与关闭行为。 |
| 修改 | `README.md`、`package.json`、`package-lock.json` | 实际操作/安全边界说明、二维码依赖和验证命令。 |

### 验证
- `node scripts/verify-lan-server.cjs`：通过认证拒绝、快照读取、资产/检查项白名单、非图片/超限拒绝、图片通知与关闭失效验证。
- `npm run build`：通过 TypeScript、Vite 构建与 Service Worker 资源生成。

### 已知限制与后续
- LAN 仅在 Windows Electron 客户端中可用；普通 Web ZIP 不提供实时同步。
- `.evidence` 离线流程不再作为日常采集操作入口，仅用于历史兼容与紧急恢复。
- HTTP 不具备传输保密性；仅限可信 Wi-Fi 或可信个人热点。Windows 防火墙或企业网络策略可能阻止手机访问。
- 当前服务不做跨网络、账号、多用户或自动发现；会话 URL 需通过二维码或复制方式在同网段手机浏览器打开。多网卡环境由用户在弹窗选择手机实际可访问的 Wi-Fi/热点地址。
