import fs from 'fs'

import { defineConfig } from 'vite'

import react from '@vitejs/plugin-react'

import { basePlugins, lib } from './vite.lib'

if (!fs.existsSync(lib.entry)) {
  lib.entry = lib.entry.replace('.ts', '.tsx')
}

/**
 * @type {import('vite').UserConfig}
 */
export default defineConfig({
  plugins: [react(), ...basePlugins],
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
