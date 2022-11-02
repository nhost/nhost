import { defineConfig } from 'vite'

import baseConfig from '../../config/vite.lib.config'

export default defineConfig({
  ...baseConfig,
  test: {
    ...(baseConfig.test || {}),
    include: [`e2e/**/*.{spec,test}.{ts,tsx}`],
    testTimeout: 30000,
    environment: 'node'
  }
})
