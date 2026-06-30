import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'child_process'

function getVersion(): string {
  try {
    const hash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
    const date = execSync('git log -1 --format=%cd --date=format:%Y-%m-%d', { encoding: 'utf-8' }).trim()
    return `${date}-${hash}`
  } catch {
    return 'unknown'
  }
}

export default defineConfig({
  base: '/homework_timer/',
  define: {
    __APP_VERSION__: JSON.stringify(getVersion())
  },
  server: {
    host: '0.0.0.0'
  },
  plugins: [
    {
      name: 'dev-version',
      configureServer(server) {
        server.middlewares.use('/__version', (_req, res) => {
          res.setHeader('Content-Type', 'text/plain')
          res.setHeader('Cache-Control', 'no-cache')
          res.end(getVersion())
        })
      }
    } satisfies Plugin,
    react(),
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '作业计时器',
        short_name: '作业计时',
        description: '记录和统计每日作业时间的工具',
        theme_color: '#4F46E5',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/homework_timer/#/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        clientsClaim: true
      }
    })
  ]
})
