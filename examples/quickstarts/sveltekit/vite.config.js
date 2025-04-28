import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      '@nhost/nhost-js': path.resolve(__dirname, '../../../packages/nhost-js/dist/index.esm.js'),
      '@nhost/hasura-auth-js': path.resolve(__dirname, '../../../packages/hasura-auth-js/dist/index.esm.js'),
      '@nhost/hasura-storage-js': path.resolve(__dirname, '../../../packages/hasura-storage-js/dist/index.esm.js'),
      '@nhost/graphql-js': path.resolve(__dirname, '../../../packages/graphql-js/dist/index.esm.js'),
    }
  },
  optimizeDeps: {
    include: ['@nhost/nhost-js']
  },
  build: {
    rollupOptions: {
      external: ['esm-env']
    }
  },
  server: {
    port: 3000
  }
})
