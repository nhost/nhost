import { defineConfig } from 'vite'

import baseConfig from '../../config/vite.lib.config'

export default defineConfig({
  ...baseConfig,
  test: {
    ...(baseConfig.test || {}),
    include: [`tests/unit/**/*.{spec,test}.{ts,tsx}`],
    testTimeout: 30000,
    environment: 'node'
  }
})
