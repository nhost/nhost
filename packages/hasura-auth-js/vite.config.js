import { defineConfig } from 'vite'

import baseConfig from '../../config/vite.lib.config.js'

export default defineConfig({
  ...baseConfig,
  test: {
    ...(baseConfig.test || {}),
    testTimeout: 30000,
    environment: 'node'
  }
})
