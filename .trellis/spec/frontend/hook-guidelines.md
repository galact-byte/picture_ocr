# Hook 规范

> 跨组件共享逻辑放在 `src/hooks/`；只服务一套 UI 的 hook 可与组件同文件定义，全局项目状态通过 Context hooks 提供。

## 当前模式

- Context 层导出 `useAppContext()`、`useAppState()` 与 `useDispatch()`，并在缺少 `AppProvider` 时抛出明确错误；实现见 `src/context/AppContext.tsx`。需要项目全局数据时优先使用它们，而不是层层透传 state/dispatch。
- `useConfirmDialog()` 定义并导出在 `src/components/ConfirmDialog.tsx`，返回命令式的 `confirm` 与待渲染的 `dialog`。这是当前“一个 hook 只服务一套对话框组件”的实际组织方式。
- 局部 `useState` 处理表单、开关、选中项和加载状态。`src/components/ProjectList.tsx`、`src/components/project-list/NewProjectDialog.tsx` 是示例。
- 派生集合或快照用 `useMemo`，例如 `src/App.tsx` 的 `lanSnapshot`，以及 `src/components/LanMobileCollector.tsx` 的 `activeAsset` 与 `visibleAssets`。
- effect 内的异步工作以内部函数配合 `void` 调用；返回 cleanup。`LanMobileCollector.tsx` 使用 `AbortController` 取消轮询与 fetch，并在 cleanup 清除 interval；`AppContext.tsx` 在卸载时取消定时器并刷新待保存内容。

## 依赖与资源生命周期

- `useCallback` 的依赖数组必须包含回调读取的状态/props。`src/App.tsx` 中 LAN session、Word 导出与模板保存 handlers 是参考。
- 订阅、定时器、媒体流和浏览器事件必须在 effect cleanup 中释放：`src/App.tsx` 移除 `hashchange` 监听并停止 LAN 会话；`LanMobileCollector.tsx` 终止 `AbortController`、清理 interval 和 camera tracks。
- `src/hooks/useImageSrc.ts` 由缩略图、预览和手机采集页共用，返回 `{ status, src?, onError }`。`status` 为 `loading` / `loaded` / `missing` / `error`；只有 `loaded` 渲染图片并把 `onError` 绑定到原生 `img`，解码失败切换为 `error`，缺图或读取失败不能显示为加载中。
- 图片结果以项目 ID、图片 ID 和内联字节作为身份；effect cleanup 拒绝旧请求结果，身份改变的首帧也不能显示上一张图。底层 `imageCache.ts` 使用 `${projectId}:${imageId}` 缓存键和成功字节 LRU，不缓存空值或拒绝结果。缓存清理与请求去重沿用既有实现。
- 对异步竞争或需要读取最新值的流程，现有实现使用 ref 保存可变最新状态，例如 `AppContext.tsx` 的 `stateRef`/`latestDocRef`，和 `LanMobileCollector.tsx` 的 `snapshotRef`、`refreshInFlightRef`。使用 ref 时必须同时维护其生命周期，不能以它替代应触发渲染的 state。
- 对指针拖拽中的 `requestAnimationFrame` 循环，沿用 `ContentArea.tsx` 的显式停止模式：将 frame ID 与最新指针位置放进 ref；仅在实际拖拽和需要滚动的边缘区域启动；指针离开边缘、到达滚动边界、`pointerup`、`pointercancel`、退出模式、切换资产与组件卸载都必须调用同一停止函数。自动滚动后需按当前指针重新计算投放预览，不能使用滚动前的卡片矩形。

## 数据获取

- 未使用 React Query、SWR 或通用 fetch hook。浏览器端 API 请求在消费它的组件内完成，例如 `LanMobileCollector.tsx` 的会话拉取、上传与保存确认轮询。
- 外部响应按不可信数据处理：检查 `response.ok`/状态码，`json()` 失败提供回退消息，并将 `unknown` 错误缩窄为 `Error` 后展示中文可理解提示。

## 避免

- 不要新建仅为“统一形式”的 hooks 目录；先确认逻辑确有跨组件复用。
- 不要让 effect 返回 Promise，也不要遗留 interval、事件监听、AbortController 或媒体流。
- 不要省略 effect/callback 依赖，或用禁用 lint 的方式压制陈旧闭包问题。
