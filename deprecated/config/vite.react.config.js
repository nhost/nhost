import { defineConfig } from 'vite'

import react from '@vitejs/plugin-react'

import baseLibConfig from './vite.lib.config'

export default defineConfig({
  ...baseLibConfig,
  optimizeDeps: {
    include: ['react/jsx-runtime'],
    exclude: ['react-hook-form']
  },
  plugins: [react({ jsxRuntime: 'classic' }), ...baseLibConfig.plugins]
})
