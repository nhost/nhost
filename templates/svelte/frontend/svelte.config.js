import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // The app is client-side only (see src/routes/+layout.ts), so a static
    // SPA fallback is served for every route.
    adapter: adapter({ fallback: 'index.html' }),
    alias: {
      $gql: 'src/gql',
    },
  },
};

export default config;
