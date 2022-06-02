import { defineConfig } from 'vite'

import viteReactConfig from './vite.react.config'

export default defineConfig({
  ...viteReactConfig,
  build: {
    ...viteReactConfig.build,
    watch: {
      buildDelay: 500
    }
  }
})
