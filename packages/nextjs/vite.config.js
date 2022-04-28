import { defineConfig } from 'vite'

import reactConfig from '../../vite.react.config'

import pkg from './package.json'

export default defineConfig({
  ...reactConfig,
  build: {
    ...reactConfig.build,
    rollupOptions: {
      ...reactConfig.build?.rollupOptions,
      external: [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})]
    }
  }
})
