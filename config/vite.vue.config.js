import { defineConfig } from 'vite'

import vue from '@vitejs/plugin-vue'

import baseLibConfig from './vite.lib.config.js'

export default defineConfig({
  ...baseLibConfig,
  plugins: [vue(), ...baseLibConfig.plugins]
})
