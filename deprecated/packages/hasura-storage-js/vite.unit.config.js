import { defineConfig } from 'vite'

import baseConfig from '../../config/vite.lib.config'

const PWD = process.env.PWD

export default defineConfig({
  ...baseConfig,
  test: {
    ...(baseConfig.test || {}),
    testTimeout: 30000,
    environment: 'node',
    include: [`${PWD}/src/**/*.{spec,test}.{ts,tsx}`]
  }
})
