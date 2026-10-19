# 追加复查记录

## 范围与方式
用户要求复查是否还有问题。本轮由主会话直接审查和隔离复现，没有新增子代理，没有修改业务代码，没有提交或操作真实用户库。复查本轮差异中的导航/模态生命周期、旧库引导和转组数据保护，并对公共确认框的组合场景进行补测。

## 已确认问题
### 模板管理中的删除确认点击遮罩会同时关闭两层窗口
- 操作：打开模板管理 → 点击某个默认检查项的删除按钮 → 点击删除确认框外的暗色区域。
- 预期：取消删除，仍留在模板管理。
- 实际：删除确认和模板管理同时关闭，回到工作台。Web/Electron 均复现；点击前 dialog 数量 2，点击后为 0。
- 原因：`src/components/ConfirmDialog.tsx:91` 的遮罩 `onClick={onCancel}` 未阻止冒泡；事件继续到 `src/components/TemplateDialog.tsx:87` 的外层 `onClick={onClose}`。
- 归属：这两处点击逻辑在本次修改前已经存在，不是本次窄屏调整新增。建议局部阻止确认框遮罩点击冒泡，并增加双端回归。不应借此扩改模板管理。
- 数据影响：本次取消未执行删除；重新打开模板管理后，输入框中的测试草稿仍存在，不能宣称草稿丢失。
- 状态：后续用户明确授权修复，现已完成。原检查阶段未改业务代码；修复仅为 ConfirmDialog 遮罩 onClick 添加 stopPropagation，保留原取消回调。

## 补充验证通过
- 双端 320×568 下长英文资产名称删除确认：面板上下边界约 92.5/475.5px，底部按钮约 422.5–458.5px，均在 568px 视口内，没有确认按钮不可达的问题。
- 导航打开时路由退出到列表：背景 inert 被清理；重新进入工作台后使用原生 Enter 开启、Escape 关闭导航，焦点回到分类导航按钮。
- 核对 `.trellis/.runtime/workspace-final-regression.log`：原 11 条回归均 EXIT 0；本轮未改业务代码，不重复跑整个长套件。
- `git diff --check` 通过；只有用户原有 workflow.md 的换行提示。

## 授权后修复与验证
- 永久回归进入 `scripts/workspace-browser-cases.mjs` 和 `verify-project-list-ui.mjs --workspace`。修改前实际失败于“关闭删除确认不能同时关闭模板管理”，见 `.trellis/.runtime/template-backdrop-red.log`。
- Web/Electron 各在 375/1440px 验证点击遮罩、取消按钮、Escape 和确认删除四条路径：外层窗口及输入保留；取消不删默认项且恢复原焦点；确认只删除目标默认项。新增 16 个报告组，工作台套件共 76 组通过。
- 新鲜构建、工作台 76 组、列表 43 组及预设 52 组全部通过。日志为 `.trellis/.runtime/template-backdrop-{build,green,list,presets}.log`；未重复运行未受影响的整套 11 项。
- 原补测脚本再次双端通过，日志 `template-backdrop-recheck.log`：遮罩点击后 templateRemaining=true、dialog 数量为 1。已查看修复后的桌面截图，模板窗口、默认项、输入草稿和按钮均保留。
- 下方观察 JSON 与截图已被本次修复后复验更新；旧故障保留在 `recheck.log` 和 RED 日志中。

## 证据
- 运行命令：`node .trellis/.runtime/recheck-launch.mjs --workspace`
- 日志：`.trellis/.runtime/recheck.log`
- 双端观察：`.trellis/.runtime/recheck-qa/{web,desktop}-observations.json`
- 截图：同目录 `{web,desktop}-template-confirm-before.png`、`{web,desktop}-template-confirm-after.png`、`{web,desktop}-long-confirm-short.png`。
- 补测脚本：`.trellis/.runtime/recheck-probes.mjs`，通过现有隔离运行器执行，测试数据均为合成库。运行时目录不进入提交。

## 结论与边界
本轮确认上述一处旧交互问题；未发现新的转组数据保护或窄屏导航阻断问题。不代表穷尽所有缺陷，真实用户库、大库上限和真实手机相机未在本轮验证。
