# 构建与提交交付记录

## 授权与范围
用户在最后一次确认框修复通过后授权提交、推送并构建交付文件。业务提交 `3e03613`。首次误推修复分支后，用户明确本项目不需要功能分支，要求直接交付 main；已将三个交付提交快进至 `main` 并推送，远端回读为 `15ff8d741ac4c6f41475bef90d63e481cc63ec30`，未强推。既有构建与 main 的应用代码一致，无需重复打包。未创建发布标签或触发会创建 GitHub Release 的 release.yml。五个本轮任务归档，原桌面数据目录任务不变；原 `.trellis/workflow.md` 修改排除。

## 本地构建产物
输出目录：`release/3e03613/`（被 Git 忽略，不作为源码提交）。版本字段沿用 0.11.4，以提交号区分本次非正式分支构建。

| 产物 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `picture-ocr-0.11.4-3e03613-web.zip` | 384262 | `5d7a584479bb1993d6b142e59a2735dd641a9a3b13df1e112f638485012d6985` |
| `desktop/picture_ocr-0.11.4.exe` | 90781323 | `9a8d18e34e4646be676389960ca2bc6110eabbdff4493ff94d9ba7e63b1cd4ee` |

同目录提供人工 `RELEASE-NOTES.md`、`BUILD-INFO.json` 与 `SHA256SUMS.txt`。Web 包包含 dist、启动脚本、README 和许可文件，没有用户资料或本机预设。

## 实际验证
- `npm run build`、`npm run verify:pwa-build` 通过。
- 使用现有 Electron 发行目录执行 electron-builder portable 构建，`--publish never`，输出到独立目录，不清理旧 desktop-dist。
- Web ZIP 21 个条目 CRC 完整性通过，每个原始文件与 ZIP 字节一致。
- ASAR 内 18 个 dist/electron 文件与本地本次构建逐字节一致。
- 使用现有 Electron 运行时、临时 userData/sessionData 启动 ASAR 中的正式入口，页面与新建单系统/系统组对话框正常，零加载/渲染崩溃错误。未直接运行便携 EXE，以避免读取真实默认数据目录；不将 ASAR 冒烟等同于便携启动器端到端验证。
- 业务回归证据见父任务 verification.md 和窄屏子任务 recheck.md；本轮仅打包，没有业务代码变更。
- 构建日志提示沿用默认 Electron 图标；未为本任务新增图标或签名配置。

详细构建/校验日志在本机 `.trellis/.runtime/delivery-*`。归档和日志提交只改变记录，应用代码仍对应 `3e03613`。
