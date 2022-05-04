import fs from 'fs'
import path from 'path'

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import tsconfigPaths from 'vite-tsconfig-paths'

import baseLibConfig from './vite.lib.config'

const PWD = process.env.PWD
const pkg = require(path.join(PWD, 'package.json'))

const deps = [...Object.keys(Object.assign({}, pkg.peerDependencies))]

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
    ...(baseLibConfig.build || {}),
    outDir: 'umd',
    lib: {
      ...(baseLibConfig.build?.lib || {}),
      fileName: pkg.name.replace(/@nhost\//g, ''),
      formats: ['umd']
    },
    rollupOptions: {
      ...(baseLibConfig.build?.rollupOptions || {}),
      external: (id) => deps.some((dep) => id.startsWith(dep))
    }
  }
})
