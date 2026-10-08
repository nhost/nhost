import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    // A single-page app: every path is served the same index.html and the
    // router takes over in the browser. There is no server half anywhere in
    // this template, so there is nothing to render on one.
    adapter: adapter({ fallback: 'index.html' }),
  },
};
