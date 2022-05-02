import { defineConfig } from 'vite'

import viteConfig from './vite.config'

export default defineConfig({
  ...viteConfig,
  mode: 'development',
  build: {
    ...viteConfig.build,
    watch: {
      buildDelay: 500
    }
  }
})
