import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// The tests cover plain TypeScript modules, so they run without the SvelteKit
// plugin and its generated .svelte-kit types.
export default defineConfig({
  resolve: {
    alias: {
      $gql: fileURLToPath(new URL('./src/gql', import.meta.url)),
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
});
