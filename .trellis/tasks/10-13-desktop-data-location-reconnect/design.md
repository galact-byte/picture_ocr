# 技术设计

## 数据流

`data-location.json` → Electron `dataLocation.init()` → `app.setPath('userData')` → Chromium IndexedDB → 渲染进程列表。

路径失效时新增恢复边界：`init()` 只读取并记录异常，不创建目录；`main.cjs` 在 `app.whenReady()` 后、创建 BrowserWindow 前调用恢复流程。恢复流程打开原生目录选择器，校验用户选中的目录包含可识别的 IndexedDB 数据目录，再更新指针并设置 `userData`，随后创建窗口。取消或校验失败时退出客户端，避免默认空库伪装成正常库。

## 数据目录规则

- `isDirWritable` 改为仅检查已存在目录的写权限；缺失目录返回 false，不执行递归创建。
- `isDataDirectory` 只接受目录本身，不把普通父目录误当数据目录；至少要求 `IndexedDB` 目录存在且包含文件或子目录。
- 迁移 `chooseLocation` 保留现有“选择父目录后复制到固定子目录”的产品行为，但若目标已经存在有效 IndexedDB 数据，拒绝复制覆盖并提示先选择正确位置。
- 新增 `recoverMissingLocation`：只在启动恢复状态存在时调用。目录选择成功后写入 `dataDir`，不复制、不删除、不清理旧路径；调用方在创建窗口前设置 Electron userData。
- 现有指针中配置的路径即使已被系统重新创建为空目录，也不能自动覆盖或合并。通过启动恢复提示让用户选择真实的原数据目录；不从 LevelDB 外部值推测项目结构。

## UI / 生命周期

- 启动恢复是主进程原生对话框，不依赖渲染进程，因此空库窗口不会先出现。
- 提示包含旧路径、要求选择“包含 IndexedDB 的原数据目录”、取消后退出。
- `main.cjs` 只有恢复成功或无恢复需求时才创建主窗口。
- `StorageSettingsDialog` 在选择已有目录本身时直连；普通目录仍走迁移标记。由于主进程 API 已存在，改为返回 `mode: 'connect' | 'migrate'` 和对应文案。

## 兼容与安全

- 不删除用户目录，不移动旧目录，不自动合并两套 IndexedDB。
- 不改变 Web 端数据路径。
- 旧有效指针、默认位置和正常迁移路径保持原行为。
- 已存在的 `LEGACY_DATA_SUBDIRS` 继续只用于备份删除兼容，不把目录名当数据内容判断依据。
