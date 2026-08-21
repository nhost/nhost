import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    tailwindcss(),
    // SPA mode: the build prerenders the app shell to index.html and every
    // route renders on the client, so the app deploys as static assets.
    tanstackStart({
      spa: {
        enabled: true,
        prerender: { outputPath: '/index' },
      },
    }),
    viteReact(),
  ],
});
