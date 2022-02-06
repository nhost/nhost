import fs from 'fs'

import { defineConfig } from 'vite'

import reactRefresh from '@vitejs/plugin-react-refresh'

import { basePlugins, lib } from './vite.base'

if (!fs.existsSync(lib.entry)) {
  lib.entry = lib.entry.replace('.ts', '.tsx')
}

/**
 * @type {import('vite').UserConfig}
 */
export default defineConfig({
  plugins: [reactRefresh(), ...basePlugins],
  build: {
    lib,
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
