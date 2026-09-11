import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  cacheDir: './.vitest',
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@nhost/nhost-js/session': resolve(
        __dirname,
        '../packages/nhost-js/src/session/index.ts',
      ),
      '@nhost/nhost-js/auth': resolve(
        __dirname,
        '../packages/nhost-js/src/auth/index.ts',
      ),
      '@nhost/nhost-js/fetch': resolve(
        __dirname,
        '../packages/nhost-js/src/fetch/index.ts',
      ),
      '@nhost/nhost-js/functions': resolve(
        __dirname,
        '../packages/nhost-js/src/functions/index.ts',
      ),
      '@nhost/nhost-js/graphql': resolve(
        __dirname,
        '../packages/nhost-js/src/graphql/index.ts',
      ),
      '@nhost/nhost-js/storage': resolve(
        __dirname,
        '../packages/nhost-js/src/storage/index.ts',
      ),
      '@nhost/nhost-js': resolve(
        __dirname,
        '../packages/nhost-js/src/index.ts',
      ),
    },
  },
  test: {
    globalSetup: './vitest.global-setup.ts',
    testTimeout: 30000,
    environment: 'jsdom',
    globals: true,
    setupFiles: 'src/setupTests.ts',
    include: ['src/**/*.(spec|test).{js,jsx,ts,tsx}'],
    // NOTE: https://github.com/apollographql/apollo-client/issues/12917#issuecomment-3508911736
    onConsoleLog(log, type) {
      if (type === 'stderr') {
        if (log.includes('canonizeResults') || log.includes('addTypename')) {
          return false;
        }
      }

      return true;
    },
    deps: {
      optimizer: {
        web: {
          include: ['clsx', '@nhost/nhost-js'],
        },
      },
    },
  },
});
