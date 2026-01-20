import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['./tsconfig.test.json'] }), react()],
  cacheDir: './.vitest',
  test: {
    globalSetup: './vitest.global-setup.ts',
    testTimeout: 30000,
    environment: 'jsdom',
    globals: true,
    setupFiles: 'src/setupTests.ts',
    include: ['src/**/*.(spec|test).{js,jsx,ts,tsx}'],
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
          include: ['clsx'],
        },
      },
    },
  },
});
