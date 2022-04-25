import { defineConfig } from 'vite'

import reactConfig from '../../vite.react.config'

export default defineConfig({
  ...reactConfig,
  build: {
    ...reactConfig.build,
    rollupOptions: {
      ...reactConfig.build?.rollupOptions,
      external: [
        ...reactConfig.build?.rollupOptions?.external,
        '@nhost/nhost-js',
        'cookies',
        'next'
      ]
    }
  }
})
