import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import baseLibConfig from './vite.lib.config'

export default defineConfig({
  ...baseLibConfig,
  plugins: [react(), ...baseLibConfig.plugins]
})
