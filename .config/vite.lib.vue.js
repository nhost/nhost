import { defineConfig } from 'vite'

import vue from '@vitejs/plugin-vue'

import { lib, plugins } from './vite.lib'

/**
 * @type {import('vite').UserConfig}
 */
export default defineConfig({
  plugins: [
    vue(),
    ...plugins

  ],
  build: {
    lib,
    rollupOptions: {
      external: ['vue', '@nhost/vue'],
      output: {
        globals: {
          vue: 'Vue',
          '@nhost/vue': '@nhost/vue'
        }
      }
    }
  }
})
