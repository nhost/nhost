import { defineConfig } from 'vite'

import viteVueConfig from './vite.vue.config'

export default defineConfig({
  ...viteVueConfig,
  build: {
    ...viteVueConfig.build,
    watch: {
      buildDelay: 500
    }
  }
})
