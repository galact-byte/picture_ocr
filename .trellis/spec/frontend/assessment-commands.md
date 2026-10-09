# 测评命令与检查项关联契约

## 1. 适用范围

`assessmentCommands.ts` 的内置目录、`assessmentCommandStore.ts` 的本机覆盖层、`assessmentCommandBindings.ts` 的检查项关联、`assessmentCommandDefaults.ts` 的分类默认平台/资产覆盖与受控用途派生，以及命令弹窗和检查项展示。该辅助内容不写入项目证据文档，不进入项目/预设导出包；桌面 userData 与 Web origin 的存储彼此独立。

## 2. 签名

```ts
interface CommandScope { projectId: string; categoryId?: string; assetId: string }
interface CommandDefaults { categories: Record<string, string>; assets: Record<string, string> }
readCommandChanges(storage?: Pick<Storage, 'getItem' | 'setItem'>): CommandChange[]
resolveCommandProfiles(changes: CommandChange[]): CommandProfile[]
saveCommand(profileId: string, groupId: string, snippet: CommandSnippet, expected?: CommandSnippet, storage?): Promise<CommandChange[]>
deleteCommand(profileId: string, groupId: string, expected: CommandSnippet, storage?): Promise<CommandChange[]>
commandBindingKey(target: { projectId: string; assetId: string; itemId: string }): string
readCommandBindings(storage?): Record<string, string[]>
setCommandLinked(target: CommandTarget, id: string, linked: boolean, storage?, getDefaultIds?: () => string[]): Promise<CommandBindings>
resetCommandBinding(target: CommandTarget, storage?): Promise<CommandBindings>
readCommandDefaults(storage?): CommandDefaults
setCommandDefault(kind: 'category' | 'asset', scope: CommandScope, profileId: string | null, storage?): Promise<CommandDefaults>
effectiveCommandProfile(defaults: CommandDefaults, scope: CommandScope): string | undefined
matchCommandPurpose(label: string): string | undefined
resolveItemCommandIds(profiles: CommandProfile[], defaults: CommandDefaults, bindings: CommandBindings, target: CommandTarget & CommandScope, label: string): string[]
withCommandWriteLock<T>(write: () => T): Promise<T>
copyCommandText(text: string): Promise<boolean>
```

## 3. 数据与交互契约

- `evidence-assessment-command-changes-v1`：`{ version: 1, changes: [{ profileId, groupId, id, snippet }] }`。内置覆盖存完整段，`snippet: null` 隐藏内置段；删除自定义段移除相应 change。
- `evidence-assessment-command-bindings-v1`：`{ version: 1, bindings: { [JSON.stringify([projectId, assetId, itemId])]: string[] } }`。只存命令 ID，展示每次从最新目录解析，不存正文副本。手动关联的重命名/排序不改变 ID；不得用名称存手动关联键。键存在（包括空数组）即完整覆盖默认，删除最后一条仍保存空数组；只有 `resetCommandBinding` 删除键，恢复自动默认。
- 所有内置 platform/group/snippet ID 都是持久化契约。当前段 ID 按条目位置生成，后续添加条目须末尾追加，不能移动或重新编号既有条目；若调整目录结构必须保留 ID 或设计迁移。
- 同组只有一个执行环境，SQL、宿主机 Shell、设备 CLI 分开，HighGo 版本分开。`command` 仅含命令；`note`/`viewingSteps` 永不参与复制。整组复制为命令以两个换行拼接，无搜索时复制完整组；有搜索时仅显示标题/命令/说明匹配的段，组标题匹配则展示该组全部段，并显示所属用途；搜索期间不提供整组复制。
- `saveCommand`/`deleteCommand`/`setCommandLinked`/`resetCommandBinding`/`setCommandDefault` 全部异步取得同源跨窗口互斥，再同步完成 localStorage 的完整读改写；不能先读后锁。命令与 `expected` 对比，跨窗口已修改/删除时拒绝旧快照；不同命令与检查项的改动保留。UI await 实际写入后刷新共享库，其他同源窗口经 `storage` 事件刷新。
- 互斥只用独立辅助 IDB `evidence-command-write-lock` / `mutex` 的 readwrite 事务，get 请求成功才执行同步回调；不借项目证据库事务、不变更其 schema，也不依赖安全上下文 Web Locks。锁不可用、打开失败/阻塞、事务中止和 10 秒等待超时均停止写入，不做无锁回退；连接在终态释放，迟到回调不能写入。
- 回调不得 await/嵌套取得锁。localStorage 的同步 setItem 返回即为成功点；辅助 IDB 空事务不是持久化事务，不能原子回滚 localStorage，也不能因写入后的 IDB 中止误报失败。所有同源写入窗口必须使用该锁，旧版本窗口/开发者工具绕过入口的写入不在保证范围内。
- 编辑表单校验逐字段显示错误，以 aria-invalid/aria-describedby 关联错误说明并聚焦首个错误字段；字段修正时更新标记，存储失败不把有效字段标成非法。写入等待时禁用重复写入、关闭和编辑对象切换，失败保留草稿。
- `evidence-assessment-command-defaults-v1`：`{ version: 1, categories: { [JSON.stringify([projectId, categoryId])]: profileId }, assets: { [JSON.stringify([projectId, assetId])]: profileId } }`。资产覆盖优先于分类默认，`null` 删除对应配置；浏览平台不等于保存配置。只用独立辅助存储，不迁移或回写项目。
- 自动派生仅接受受控用途/别名：身份鉴别（身份认证）、访问控制、安全审计/日志审计、登录失败、远程管理、版本及代码白名单中的精确别名；可规范化空白、编号前缀与末尾标点。组合歧义、未知及门禁不拆词匹配，不从资产名/IP猜平台；未设置平台返回空列表。匹配通过平台下稳定用途分组 ID，正文取最新库。
- 从默认第一次调整关联时，`setCommandLinked` 在锁内先读最新手动覆盖；没有覆盖才调用 `getDefaultIds`，调用方在该同步回调中读取最新命令库及默认配置。不可捕获等待锁之前的默认 ID 列表；后续调整保留锁内现读的其他手动 ID。
- 检查项入口默认折叠，无命令直接进入选择弹窗；已有命令就地展开，管理关联单独打开。行内平台/执行环境与组说明去重，成功反馈靠近被复制的段。库的编辑/删除仅在“管理命令库”模式显示；恢复默认、库编辑和平台配置写入沿用等待期间禁用、成功后刷新与失败保留。
- 自动复制优先 Clipboard API，无 API 时必须在当前用户点击内同步调用 `execCommand('copy')`；失败显示并选中完整手动文本。平台切换、关联目录刷新、关闭/卸载后忽略陈旧异步结果。
- 弹窗用 portal 加 `root.inert`、Tab 约束、Escape、焦点恢复；入口在点击时显式聚焦，避免刷新后触发按钮恢复不稳定。检查项命令区域阻止点击冒泡，不改变截图粘贴目标；排序视图不挂载该区域。

## 4. 校验与错误矩阵

| 条件 | 处理 |
| --- | --- |
| 标题空白或超过 120 字、命令空白或超过 32768 字、说明超过 4000 字 | 拒绝保存，保留表单 |
| 库超过 1000 条修改/2 Mi 字符，JSON、版本、引用或 ID 异常 | 不覆盖存储；内置库可浏览复制，暂停编辑；行内已关联内容暂停显示，避免冒充最新内容 |
| 关联目标缺少非空 ID，重复/非法命令 ID，单项超过 100 段、总量超过 5000 项/2 Mi 字符 | 拒绝写入，保留旧内容 |
| 默认平台配置版本/结构/ID/平台引用异常、超过 5000 项或 2 Mi 字符 | 停止默认派生与配置写入，原存储不变；平台浏览与内置复制仍可用 |
| 默认配置范围不含非空项目/分类或资产 ID（每段最多 300 字） | 拒绝保存，不写项目 |
| setItem 拒绝或超配额 | 明确提示，不更新成功状态，不丢弃草稿 |
| 库删除已关联命令 | 行内失效提示；不显示旧正文，允许单独取消失效关联 |
| 两种自动复制都失败 | 明确失败并选中完整文本，不报成功 |

## 5. 用例

- 正常：关联 Linux 身份鉴别段后，库内修改该段，检查项立即显示新标题/正文；刷新仍保留关联。
- 默认：同项目十台服务器一次设置 Linux 分类平台，各台“身份鉴别”继承同组；新增资产一致。Windows 单台覆盖不串入 Linux，恢复分类默认后重新继承。
- 基础：门禁或未知用途不自动挂无关命令；点击无关联入口直接选择。手动取消最后一条后刷新仍为空，恢复自动默认才重新出现。
- 异常：关联 JSON 损坏时停止关联写入，显示错误，原字符串不变。

## 6. 验证要求

- `npm run verify:assessment-commands`：通过 esbuild 执行真实目录/工具，核对内容、环境、版本、搜索、CRUD、冲突、项目/资产/检查项隔离与失败保留；受控 IDB 调度验证独立模块连接读改写串行、不同命令/检查项不丢失、同命令旧快照拒绝、锁不可用保护及逐字段校验。该模拟不等同于真实浏览器 IDB 互斥证据。
- `npm run build` 后 `npm run verify:assessment-commands-ui`：隔离 Chrome、正式 Electron main/preload 与真实非安全局域网 HTTP，CDP 实际点击后读回剪贴板，覆盖 CRUD、刷新、未保存确认、手动复制、旧异步结果、键盘、关联同步和项目数据不变；用两个真实同源页面、原生 storage 事件及实际 IDB 排他事务验证等待期间不写入、不同命令/检查项更新均保留、同命令旧快照拒绝。Electron 的辅助页面与原生剪贴板读回仅由隔离测试入口提供，生产 main/preload 不增加测试桥。截图/报告仅放 `.trellis/.runtime/assessment-command-qa/`。
- Windows 剪贴板可能把 LF 转成 CRLF，读回时仅归一化 CRLF→LF，其他字符逐字匹配。非安全页用同一 Chrome 的安全读取页验证真实回退；读取页先激活并确认 `document.hasFocus()`。Electron 自动化主页面在实际点击复制前显式启用焦点模拟并确认 `document.hasFocus()`，避免后台 CDP 目标复制回归得到陈旧系统文本；复制断言失败时只记录文本长度与状态，不输出剪贴板的其他用户内容。
- 375/768/1280 验证命令弹窗、行内代码滚动与按钮高度；行内控件验证不代表原工作台全局移动端布局已改造。
- 默认继承回归还须覆盖十台合成旧资产、实际新增资产/检查项、Windows 单台例外、受控别名与歧义、手动优先、空覆盖刷新/恢复、默认配置损坏/写失败、真实另一页面 storage 同步；配置操作前后完整项目文档和图片引用逐字不变。新增/删除夹具属于测试准备/清理，不能算作命令功能改写项目。
- 两页写入 Promise 返回后，另一 renderer 的 localStorage 可见性和原生 storage 事件仍需有界等待；测试等待真实同步条件，再断言双方字段均保留，不用固定延迟冒充同步或放宽存储结果。
- 命令内容按来源核对，缺少真实目标设备/数据库时不能称为目标执行成功。

## 7. 常见错误与正确做法

错误：把命令正文复制进检查项配置，按任意检查项文本模糊推断引用、未选择平台即猜 Linux；自动复制失败仍提示成功；读取异常时用默认空覆盖层自动保存。

正确：用 `[projectId, assetId, itemId]` 和稳定命令 ID 关联，正文从共享最新库解析；自动默认只使用显式配置平台和受控用途别名，手动空覆盖不能当成缺省；两种自动复制都失败时保留完整手动文本；坏存储只报告并保留。
