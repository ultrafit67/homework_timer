import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'child_process'

function getGitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
}

/** Virtual module that serves the current git hash, updated on commit via HMR */
function versionPlugin(): Plugin {
  const VIRTUAL_ID = '\0virtual:version'
  const resolvedId = 'virtual:version'
  return {
    name: 'version',
    resolveId(id) {
      if (id === resolvedId) return VIRTUAL_ID
    },
    load(id) {
      if (id === VIRTUAL_ID) {
        return `export default ${JSON.stringify(getGitHash())}`
      }
    },
    configureServer(server) {
      // Re-read git hash when HEAD or refs change (e.g. after commit)
      server.watcher.add('.git/HEAD')
      server.watcher.add('.git/refs/')
      server.watcher.on('change', (path) => {
        if (path.startsWith('.git/')) {
          const mod = server.moduleGraph.getModuleById(VIRTUAL_ID)
          if (mod) server.reloadModule(mod)
        }
      })
    }
  }
}

export default defineConfig({
  base: '/homework_timer/',
  server: {
    host: '0.0.0.0'
  },
  plugins: [
    versionPlugin(),
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
