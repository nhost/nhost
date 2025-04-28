import path from 'node:path'
import fs from 'node:fs'

import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import vue from '@vitejs/plugin-vue'

import baseLibConfig from './vite.lib.config'

const PWD = process.env.PWD
const pkg = JSON.parse(fs.readFileSync(path.join(PWD, 'package.json'), 'utf-8'))

const deps = [...Object.keys(Object.assign({}, pkg.peerDependencies))]

export default defineConfig({
  plugins: [vue(), tsconfigPaths()],
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
