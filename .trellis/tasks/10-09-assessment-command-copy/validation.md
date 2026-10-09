# 测评命令交付验证

## 发布决策

用户已确认按既定范围提交推送并构建 v0.11.0，明确允许保留未修复的 LAN 双窗口并发问题；本轮不等待远端构建完成。该授权不代表完整回归通过，任务保持 in_progress。排查入口为 `scripts/assessment-command-browser-cases.mjs` 的 `verifyConcurrentWrites`，需区分多键同步时序与真实丢写；在确定前建议单窗口编辑辅助命令配置。其余弹窗任务不纳入本次提交。

## 最新增量：四类继承与标题对齐

- 分类默认适用于网络设备、安全设备、服务器和数据库；纯行为验证覆盖全部 12 平台。新增真实浏览器用例覆盖网络/安全/数据库各十台资产、平台正文隔离、华为/H3C 与 MySQL/Oracle 单台例外及恢复。
- 修复搜索结果被另一窗口修改后，编辑器分组/执行环境提示丢失：从编辑对象的稳定平台/分组 ID 读取提示，保留草稿及并发冲突保护。浏览器先复现失败，修复后通过。
- 按用户截图修正 `ItemCard.tsx` 标记、标题、命令及同行右侧操作的垂直居中，去掉标记顶部偏移，保留焦点轮廓。375px 下工作台侧栏仍挤压内容，本次仅检查局部换行/对齐，不声明完成整体移动布局。
- 最新 `npm run build`、`node scripts/verify-assessment-commands.mjs`、`node scripts/verify-inspection-item-interactions.mjs`、`git diff --check` 通过；`node scripts/verify-assessment-commands-browser.mjs --layout-only` 三档宽度通过，报告为 `alignment-report.json`，截图为 `alignment-{375,768,1280}.png`。
- 扩展后的完整运行中 Web 与 Electron 的四类继承通过；LAN 在“两个页面新增的关联都保留”断言失败，整套退出码为 1，尚不能宣布全绿。当前实现等待默认配置同步后立即检查关联，需进一步区分各键同步时序与真实丢写，不能仅凭猜测忽略失败。详见 `.trellis/.runtime/assessment-command-browser-current.log`。
- 用户要求减少长测试并尽快结束，本轮不再重复整套回归。标题修正后的验证仅为短时局部验证，不替代未完成的 LAN 并发排查；下文早期通过记录不代表最终版本全绿。未提交、推送或发版，未读取或改写客户真实库。

## 前次迭代：紧凑复制与分类默认（2026-10-09）

本节为当前迭代证据；后文为先前版本验证记录，不代替本轮验收。

### 实现与兼容

- 分类默认平台、单台覆盖及恢复使用独立 `evidence-assessment-command-defaults-v1` 本机配置，全部写入复用既有跨窗口锁。旧项目不补字段、不迁移证据。
- 明确平台配合受控检查项用途/别名派生命令；不猜服务器操作系统，未知、门禁及组合歧义名称不匹配。手动关联优先，空数组完整覆盖默认，恢复时显式删除覆盖键。
- 检查项默认折叠，无命令直接选择；行内组说明去重、复制就近反馈。弹窗查看/管理分离，搜索只展示匹配段，搜索期间禁止整组复制。
- 平台默认跨窗口改变时保留正在编辑的草稿与原执行环境；窄屏复制状态允许换行，长命令内部滚动。

### 本轮实际验证

| 命令 | 结果 |
| --- | --- |
| `node scripts/verify-assessment-commands.mjs` | 五组 PASS，包含默认平台、受控匹配、十台及新增资产、空覆盖/恢复、异常保护和串行写入 |
| `npm run build` | 退出码 0，严格 TypeScript、Vite、12 资源 Service Worker 成功；仍有 chunk 大于 500kB 提示 |
| `node scripts/verify-assessment-commands-browser.mjs` | 退出码 0，Chrome localhost / Electron / 非安全 LAN HTTP 共 109 项通过 |
| `node scripts/verify-inspection-item-interactions.mjs` | 通过 |
| `node scripts/verify-inspection-item-pointer-drag.mjs` | 生产构建鼠标/触摸拖拽、预览、取消与边缘滚动通过 |
| `node scripts/verify-presets.mjs` | 九组通过 |
| `npm run verify:pending-writes` | 32/32 通过 |
| `git diff --check` | 通过 |

Red 证据为 `.trellis/.runtime/assessment-command-red.log`：旧行为返回完整组，违反“正文搜索只显示匹配段”的新增断言。随后实现并扩展纯行为/真实浏览器回归。

三环境均验证：十台合成旧服务器一次配置继承；实际通过界面新增资产及身份鉴别检查项自动继承；Windows 单台例外和恢复；未知/歧义/门禁无默认；手动优先、取消最后一条后的刷新与恢复；损坏/拒写配置原内容保留；真实第二页面原生 storage 同步。持有真实 IDB 锁时两页等待，释放后命令、关联及默认配置双方记录均保留。

保留并通过原有真实多行 Linux、设备 CLI、Windows CMD、带分号 SQL 剪贴板读回，LAN 无 Clipboard API 的实际回退，以及 CRUD、焦点/键盘、损坏存储、手动复制、陈旧异步结果、排序及粘贴目标隔离。命令配置前后完整项目文档逐字一致；全部命令流程前后分类、检查项和图片引用快照一致。新增/删除资产属于隔离测试夹具操作，清理后核对原证据快照一致。

### 当前证据路径

- `.trellis/.runtime/assessment-command-browser-current.log`：当前完整三环境运行输出。
- `.trellis/.runtime/assessment-command-build.log`：当前构建输出。
- `.trellis/.runtime/assessment-command-qa/report.json`：当前机器结果。
- 同目录 `{web,desktop,lan}-{375,768,1280}.png`：紧凑命令弹窗。
- 同目录 `{web,desktop,lan}-config-{375,768,1280}.png`：默认平台配置展开。
- 同目录 `{web,desktop,lan}-defaults-{375,768,1280}.png`：默认继承行内显示。
- 同目录 `{web,desktop,lan}-inline-{375,768,1280}.png`、`*-inline-preview.png`：行内命令及复制回退布局。

已查看 Web 三档弹窗、375px 配置展开和 1280px 行内截图。主会话继续独立复审与集中截图审阅；本实现代理未派生其他代理，不将自检称为独立复审。375px 行内控件通过局部滚动/尺寸检查，但原工作台侧栏占宽导致整体内容很窄，本轮没有重做整个工作台移动端布局。

### 范围与状态

全部测试使用隔离 Chrome profile / Electron userData 和合成项目，未读取真实 Chrome profile 或客户检查项，未上传本地资料；没有目标设备/数据库执行验证。本轮未改静态命令正文或 ID、项目 schema、其他弹窗及共用样式。任务保持 `in_progress`，未 commit/push/发布，等待主会话独立检查及界面验收。

## 先前迭代：已实现行为

- 资产页“调整顺序”旁提供“测评命令”，内置 12 平台、138 段核查命令；支持分组、搜索、单段/整组复制和命令增删改查。
- 检查项标题旁提供“命令”展开区，可选择关联内置或自定义命令，就地查看与复制。库内编辑同步更新；删除显示失效引用；门禁等未关联检查项显示空态。
- 命令库为当前应用本机共用，关联按项目、资产、检查项稳定 ID 隔离。刷新保留，重命名/排序不改变关联。桌面与 Web 各自存储，项目包和预设不包含该辅助内容。
- 命令正文与说明分开，执行环境/版本分组明确；自动复制失败提供完整可选文本。存储异常暂停写入、保留草稿与旧内容。
- 同源写入经独立辅助 IndexedDB 排队，在排他事务请求回调内同步完成 localStorage 读改写；不同窗口的新增不会整库互相覆盖，同条命令的旧快照更新会被拒绝。

## 先前迭代验证

| 命令 | 实际结果 |
| --- | --- |
| `node scripts/verify-assessment-commands.mjs` | 四组 PASS：12 平台/138 段、CRUD/异常、关联/隔离、独立连接并发/字段校验 |
| `npm run build` | TypeScript、Vite 与 Service Worker 生成成功，预缓存 12 个资源 |
| `node scripts/verify-assessment-commands-browser.mjs` | 退出码 0；localhost Chrome、正式 Electron main/preload、实际非安全 LAN HTTP 全部通过 |
| `node scripts/verify-inspection-item-interactions.mjs` | 检查项新增、排序模型与交互契约通过 |
| `node scripts/verify-inspection-item-pointer-drag.mjs` | 生产构建鼠标/触摸拖拽、预览、取消与边缘滚动通过 |
| `node scripts/verify-presets.mjs` | 九组预设兼容验证通过 |
| `npm run verify:pending-writes` | 32/32 通过 |
| `git diff --check` | 通过 |

三环境真实界面覆盖：

- 实际点击多行 Linux、华为/H3C、Windows CMD、MySQL 和 Oracle 命令，读回剪贴板；Windows 仅将 CRLF 归一化为 LF，其余字符一致。Electron 由测试主进程读取原生系统剪贴板；LAN 页面没有 Clipboard API，验证同步 execCommand 回退并经同一浏览器安全页读回。
- 四类/自定义/未分类定位、搜索空态、平台切换、关闭重开、刷新、内置覆盖/隐藏、自定义新增/删除、未保存确认、存储拒绝/损坏、手动复制和陈旧异步结果。
- 实际 Tab/Escape/Enter、弹窗焦点约束及返回入口焦点；375/768/1280px 的弹窗与行内命令滚动、44px 按钮。
- 检查项关联、库编辑/删除同步、取消失效引用、刷新保留、重命名/排序保留、跨项目/资产隔离，命令操作不改变截图粘贴目标。
- 两个独立同源页面真实编辑，经原生 storage 事件同步到检查项；持有真实 IDB 排他事务时两页的写入等待、存储不变；释放后双方命令与不同检查项关联均保留，同命令旧快照修改被拒绝。Electron 第二页面为隔离测试入口创建的同源辅助窗口，不改变生产主进程或 preload。
- 断网后打开命令，操作前后项目分类、检查项及图片快照一致。

## 证据位置

最终浏览器日志、退出码、机器报告与截图位于忽略目录 `.trellis/.runtime/assessment-command-qa/`：

- `final-run.log`、`final-run-exit.txt`（0）、`report.json`。
- `desktop-inline-preview.png`、`web-inline-preview.png`、`lan-inline-preview.png`：检查项命令展开的实际运行界面。
- `{web,desktop,lan}-{375,768,1280}.png`：命令弹窗。
- `{web,desktop,lan}-inline-{375,768,1280}.png`：检查项命令区域。

测试采用临时 userData/Chrome profile 与合成项目，不读取用户真实证据库。运行结束关闭测试进程并清理临时 profile；截图和报告保留供验收。

## 先前迭代独立复审

`trellis-check` 集中复审未发现剩余 P1/P2 生产问题，确认互斥、异步调用方、迟到回调、存储成功点、字段 ARIA、storage 同步及测试入口与生产代码边界。复审另外以纯逻辑故障注入确认：setItem 成功后的辅助事务中止不改报失败；未取得锁的事务超时后，迟到请求不执行写入。

字段错误、持锁等待期间禁用关闭/重复保存的代码与纯行为已检查；尚未单独以真实鼠标/键盘验证 UI 在锁等待期间的关闭/重复提交。这不计入已完成浏览器用例。

## 来源及验证边界

目录的 `source` 字段与 `research/command-reference.md` 记录用户指定笔记来源。按平台拆分、去除 SQL 裸中文/错误注释、将版本、权限、参数及默认策略核查边界放入说明；内置正文为通用核查命令，不附客户输出或凭证。

命令做过资料内容核对、目录校验与真实复制验证，没有在实际华为/H3C/USG、Windows/Linux 服务器或各数据库实例上逐条执行，不能作为目标版本执行成功证明。占位参数仍需现场替换。

构建有大于 500kB chunk 的提示，未阻止构建。此次验证不包含安装包制作、发布或用户现场真机验收。

## 交付状态

本任务保持 `in_progress`，应用源码与构建产物供用户查看效果。按实施计划的界面验收门禁，验收后再进入提交阶段；提交范围须排除任务开始前已有的弹窗样式改动。
