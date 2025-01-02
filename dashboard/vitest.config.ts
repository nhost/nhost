import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // @ts-ignore
  plugins: [tsconfigPaths({ projects: ['./tsconfig.test.json'] }), react()],
  test: {
    testTimeout: 30000,
    environment: 'jsdom',
    globals: true,
    setupFiles: 'src/setupTests.ts',
    include: ['src/**/*.(spec|test).{js,jsx,ts,tsx}'],
  },
});
