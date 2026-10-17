import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createIntakeHandler } from './server/intake'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const intake = createIntakeHandler({ apiKey: env.LLM_API_KEY || '', baseUrl: env.LLM_BASE_URL || '', model: env.LLM_MODEL || '' })
  return {
    plugins: [
      vue(),
      { name: 'dining-intake', configureServer(server) { server.middlewares.use(intake) }, configurePreviewServer(server) { server.middlewares.use(intake) } },
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
