import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

// 同一份构建输入保持同一标识；同版本更新前端后，旧错误不再混入当前反馈。
const buildHash = createHash('sha256')
function hashBuildInput(relative: string): void {
  const url = new URL(relative, import.meta.url)
  if (statSync(url).isDirectory()) {
    for (const name of readdirSync(url).sort()) hashBuildInput(`${relative}/${name}`)
  } else {
    buildHash.update(relative).update('\0').update(readFileSync(url)).update('\0')
  }
}
for (const input of ['src', 'public', 'index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'postcss.config.js', 'tailwind.config.js']) {
  hashBuildInput(`./${input}`)
}
const buildId = buildHash.digest('hex').slice(0, 16)

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  build: {
    rollupOptions: {
      output: {
        // 大型第三方库单独分块，避免首屏主 bundle 臃肿。
        manualChunks: {
          docx: ['docx'],
          jszip: ['jszip'],
          qrcode: ['qrcode'],
        },
      },
    },
  },
})
