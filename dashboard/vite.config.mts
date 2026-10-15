import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type Plugin } from 'vite';
import { getThemeScript } from './src/providers/Theme/themeScript';
import { THEME_STORAGE_KEY } from './src/utils/constants/common/common';

// Sets the theme class before the first paint (see themeScript.ts).
function themeScriptPlugin(): Plugin {
  return {
    name: 'nhost-theme-script',
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          children: getThemeScript(THEME_STORAGE_KEY),
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

export default defineConfig({
  plugins: [
    // The router plugin must come before the React plugin.
    tanstackRouter({
      target: 'react',
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
      autoCodeSplitting: true,
      routeFileIgnorePattern: '\\.test\\.tsx?$',
    }),
    react(),
    themeScriptPlugin(),
    // `pnpm analyze` writes the bundle treemap to dist/stats.html.
    process.env.ANALYZE === 'true' &&
      visualizer({ filename: 'dist/stats.html', gzipSize: true }),
  ],
  // Keep the existing variable names so `.env.local`, Vercel and the CLI's
  // compose configuration work unchanged.
  envPrefix: 'NEXT_PUBLIC_',
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 3000,
  },
  preview: {
    port: 3000,
  },
});
