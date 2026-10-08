import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Vitest runs the plain TypeScript here - the actions, the destination parser,
// the session storage - which is everything in this app that is not a screen.
// Rendering a React Native component needs Metro and a device runtime, so the
// screens are left to `pnpm build`, which type-checks and bundles them.
export default defineConfig({
  // `__DEV__` is a global Metro defines for every React Native bundle. Vitest
  // is standing in for Metro here, so it has to define it too, or any module
  // that reads it throws on import.
  define: {
    __DEV__: 'true',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
