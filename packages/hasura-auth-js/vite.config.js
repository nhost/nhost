import { defineConfig } from 'vite'

import baseConfig from '../../vite.config.base'

export default defineConfig({
  ...baseConfig,
  build: {
    ...baseConfig.build,
    rollupOptions: {
      ...baseConfig.build?.rollupOptions,
      external: ['@nhost/core']
    }
  }
})
