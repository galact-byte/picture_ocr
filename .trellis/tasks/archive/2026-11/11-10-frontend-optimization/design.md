# 技术设计文档：前端构建分块与工作台输入无障碍优化

## 1. 架构与边界

本优化严格遵守既有架构边界与规范要求：
- 不改变数据持久化（IndexedDB / `db.ts`）与 Reducer 动作协议。
- 不引入新的外部依赖包（零新依赖）。
- 仅在表现层（Vite 配置、组件拆分、微交互样式）做局部、可验证的改进。

## 2. 详细设计

### 2.1 打包分块方案 (`vite.config.ts`)
在 `build.rollupOptions.output.manualChunks` 中扩展：
```ts
manualChunks: {
  docx: ['docx'],
  jszip: ['jszip'],
  qrcode: ['qrcode'],
}
```
`docx`、`jszip`、`qrcode` 独立分块后，实测主包约 495kB，低于 500kB 告警阈值。`jszip`、`qrcode` 目前仍由业务静态导入，入口仍预加载，首屏总下载量不因此减少；不将拆包描述为按需加载。

### 2.2 输入隔离组件设计 (`src/components/ContentArea.tsx`)
提取 `AddItemBar`：
```tsx
interface AddItemBarProps {
  onAddItem: (label: string) => void;
  draftRef: React.MutableRefObject<string>;
}
```
内部持有 `useState(draftRef.current)`，输入只更新该组件状态并同步父级 ref；排序或空分类导致卸载时，重新挂载从 ref 恢复草稿。添加后同时清空 state 与 ref。
`ContentArea` 的 `handleAddItem` 使用 `useCallback`，只依赖 `dispatch`，通过实时 `activeAssetRef` 选择提交目标；所有 Hook 均位于空状态提前返回之前。
由于状态下沉，用户输入过程中的高频渲染完全被限制在 `AddItemBar` 内部，阻断向上冒泡。

### 2.3 无障碍与触控热区方案 (`src/components/ItemCard.tsx` / `UploadZone.tsx`)
- `ItemCard.tsx`:
  重命名与删除按钮的 Tailwind 类从 `p-1 text-gray-400 ...` 调整为：
  `inline-flex min-h-11 min-w-11 items-center justify-center text-gray-400 transition-colors hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500`
  图标本身保持小巧，外围提供满足 HIG / Web 标准的 44×44px 触控/点击盒子。
- `UploadZone.tsx`:
  补齐 `onKeyDown`:
  ```tsx
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };
  ```
  增加 `role="button"`，确保屏幕阅读器和键盘能正常辨识与触发。

## 3. 风险与回滚

- **风险**：分块可能导致测试脚本启动开发服务器/静态服务器时缺少 chunk 预缓存。
  **防护**：`scripts/generate-service-worker.mjs` 会自动遍历 `dist/` 收集所有静态 chunk，构建完成后运行 `npm run verify:pwa-build` 确认 Service Worker 清单完整。
- 视觉收口：8px 卡片/弹窗、6px 控件，浅灰蓝侧栏与纯色画布，页头必填进度、卡片红/绿/灰侧条；不改 Gemini 当前布局，减少动态效果时关闭动画。
- **回滚点**：仅还原本次相应变更，不覆盖用户既有修改；问题先由回归复现。
