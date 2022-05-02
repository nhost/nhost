import fs from 'fs'
import path from 'path'

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import tsconfigPaths from 'vite-tsconfig-paths'

import baseConfig from './vite.config.base'

const PWD = process.env.PWD

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    dts({
      exclude: ['**/*.spec.ts', '**/*.test.ts', '**/tests/**'],
      afterBuild: () => {
        const types = fs.readdirSync(path.join(PWD, 'umd/src'))
        types.forEach((file) => {
          fs.renameSync(path.join(PWD, 'umd/src', file), path.join(PWD, 'umd', file))
        })
        fs.rmdirSync(path.join(PWD, 'umd/src'))
      }
    })
  ],
  build: {
    ...(baseConfig.build || {}),
    outDir: 'umd',
    lib: {
      ...(baseConfig.build?.lib || {}),
      formats: ['umd']
    }
  }
})
