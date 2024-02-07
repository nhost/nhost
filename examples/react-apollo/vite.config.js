import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    include: ['react/jsx-runtime'],
    exclude: ['@nhost/react']
  },
  resolve: {
    alias: {
      src: path.resolve(__dirname, './src')
    }
  },
  plugins: [react()]
})
