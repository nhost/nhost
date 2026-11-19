import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      adapter: adapter(),
      compilerOptions: {
        // Runes everywhere but in dependencies, which pick their own mode.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
        // Components that `await` a remote query. See "How it works" in the
        // README.
        experimental: { async: true },
      },
      experimental: { remoteFunctions: true },
      // SvelteKit adds a nonce to every script it renders, so only those and
      // files from this origin run. frame-ancestors closes clickjacking.
      csp: {
        mode: 'auto',
        directives: {
          'script-src': ['self'],
          'object-src': ['none'],
          'base-uri': ['self'],
          'frame-ancestors': ['none'],
        },
      },
    }),
  ],
  // Auth only redirects to the app origin in .secrets, and passkeys are bound
  // to its hostname, so the dev server never moves to another port or host.
  server: { host: 'localhost', port: 3000, strictPort: true },
  test: {
    projects: [
      {
        extends: true,
        plugins: [svelteTesting()],
        test: {
          name: 'client',
          environment: 'happy-dom',
          include: ['src/**/*.svelte.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.svelte.test.ts'],
        },
      },
    ],
  },
});
