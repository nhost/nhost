import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [sveltekit()],
  optimizeDeps: {
    include: ['@nhost/nhos-js']
  },
  build: {
    commonjsOptions: {
      include: [/@nhost\/nhos-js/, /node_modules/]
    }
  },
  server: {
    port: 3000
  },
  resolve: {
    preserveSymlinks: false
  }
})
