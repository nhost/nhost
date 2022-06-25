import { defineConfig } from 'vite'

import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    include: ['react/jsx-runtime'],
    // * Shim: do not optimize @nhost/react when running this example in the Nhost monorepo
    exclude: process.env.PNPM_PACKAGE_NAME === 'nhost-root' ? ['@nhost/react'] : []
  },
  plugins: [react()]
})
