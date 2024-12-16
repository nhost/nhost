import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  plugins: [sveltekit()],

  optimizeDeps: {
    include: ['@nhost/nhost-js']
  },
  build: {
    rollupOptions: {
      external: ['esm-env']
    },
    commonjsOptions: {
      include: [path.resolve(__dirname, '../../../packages/nhost-js'), /node_modules/] // Resolve monorepo package
    }
  },
  server: {
    port: 3000
  },
  resolve: {
    preserveSymlinks: true
  }
})
