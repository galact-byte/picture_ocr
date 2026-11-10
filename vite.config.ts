import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
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
