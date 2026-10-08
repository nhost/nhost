import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Auth emails and the OAuth callback point at `VITE_APP_ORIGIN`, which
    // defaults to this port, so fail on a busy port rather than move off it
    // and leave every sign-in link landing on whatever holds 3000.
    port: 3000,
    strictPort: true,
  },
});
