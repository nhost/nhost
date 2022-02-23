import fs from 'fs'
import path from 'path'

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import tsconfigPaths from 'vite-tsconfig-paths'

import react from '@vitejs/plugin-react'

const PWD = process.env.PWD
const pkg = require(path.join(PWD, 'package.json'))

const tsEntry = path.resolve(PWD, 'src/index.ts')
const entry = fs.existsSync(tsEntry) ? tsEntry : tsEntry.replace('.ts', '.tsx')

/**
 * @type {import('vite').UserConfig}
 */
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    dts({
      exclude: ['**/*.spec.ts', '**/*.test.ts', '**/tests/**'],
      afterBuild: () => {
        const types = fs.readdirSync(path.join(PWD, 'dist/src'))
        types.forEach((file) => {
          fs.renameSync(path.join(PWD, 'dist/src', file), path.join(PWD, 'dist', file))
        })
        fs.rmdirSync(path.join(PWD, 'dist/src'))
      }
    })
  ],
  build: {
    lib: {
      entry,
      name: pkg.name,
      fileName: 'index'
    },
    rollupOptions: {
      external: ['react'],
      output: {
        globals: {
          react: 'react'
        }
      }

      //   external: ['react', 'vue'],
      //   output: {
      //     globals: {
      //       react: 'react',
      //       vue: 'vue' // ? check
      //     }
      //   }
    }
  }
})
