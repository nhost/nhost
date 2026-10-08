import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    // Auth emails and the OAuth callback point at `VITE_APP_ORIGIN`, which
    // defaults to this port, so fail on a busy port rather than move off it
    // and leave every sign-in link landing on whatever holds 3000.
    port: 3000,
    strictPort: true,
  },
});
