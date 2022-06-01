import { defineConfig } from 'vite'

import viteLibConfig from './vite.lib.config.js'

export default defineConfig({
  ...viteLibConfig,
  build: {
    ...viteLibConfig.build,
    watch: {
      buildDelay: 500
    }
  }
})
