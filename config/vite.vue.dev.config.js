import { defineConfig } from 'vite'

import viteVueConfig from './vite.vue.config.js'

export default defineConfig({
  ...viteVueConfig,
  build: {
    ...viteVueConfig.build,
    watch: {
      buildDelay: 500
    }
  }
})
