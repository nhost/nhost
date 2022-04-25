import { defineConfig } from 'vite'

import baseConfig from '../../vite.config.base'

export default defineConfig({
  ...baseConfig,
  build: {
    ...baseConfig.build,
    rollupOptions: {
      ...baseConfig.rollupOptions,
      external: ['@apollo/client', 'graphql', 'graphql-ws']
    }
  }
})
