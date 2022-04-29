import { defineConfig } from 'vite'

import baseConfig from '../../vite.config.base'

import pkg from './package.json'

const deps = [...Object.keys(Object.assign({}, pkg.peerDependencies, pkg.dependencies))]

export default defineConfig({
  ...baseConfig,
  build: {
    ...baseConfig.build,
    rollupOptions: {
      ...baseConfig.rollupOptions,
      external: (id) => deps.some((dep) => id.startsWith(dep))
    }
  }
})
