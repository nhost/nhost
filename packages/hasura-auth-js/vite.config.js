import { defineConfig } from 'vite'

import baseConfig from '../../config/vite.lib.config'

export default defineConfig({
  ...baseConfig,
  build: {
    ...baseConfig.build,
    rollupOptions: {
      ...baseConfig.build.rollupOptions,
      external: (id) =>
        id !== '@simplewebauthn/browser' && baseConfig.build.rollupOptions.external(id)
    }
  }
})
