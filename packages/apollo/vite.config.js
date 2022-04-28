import { defineConfig } from 'vite'

import baseConfig from '../../vite.config.base'

import pkg from './package.json'

export default defineConfig({
  ...baseConfig,
  build: {
    ...baseConfig.build,
    rollupOptions: {
      ...baseConfig.rollupOptions,
      external: [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})]
    }
  }
})
