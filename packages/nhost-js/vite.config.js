import { defineConfig } from 'vite'

import baseConfig from '../../vite.config.base'

export default defineConfig({
  ...baseConfig,
  build: {
    ...baseConfig.build,
    rollupOptions: {
      ...baseConfig.build?.rollupOptions,
      external: [
        'axios',
        'jwt-decode',
        'query-string',
        '@nhost/hasura-auth-js',
        '@nhost/hasura-storage-js'
      ]
    }
  }
})
