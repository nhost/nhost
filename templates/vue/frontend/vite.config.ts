import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';
import VueRouter from 'vue-router/vite';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, import.meta.dirname);

  // The values are written into the bundle, so only the build can tell.
  if (
    command === 'build' &&
    !(env.VITE_NHOST_SUBDOMAIN && env.VITE_NHOST_REGION)
  ) {
    console.warn(
      'Nhost: VITE_NHOST_SUBDOMAIN and VITE_NHOST_REGION were unset when this build ran, so the app targets the local stack (local.*.local.nhost.run). Set both before `vite build`; setting them at runtime has no effect.',
    );
  }

  return {
    plugins: [
      // Before vue(), which then compiles the pages it found.
      VueRouter({
        routesFolder: 'src/app',
        // Pages and layouts are lowercase (`index.vue`, `_parent.vue`); a
        // component kept next to them is PascalCase, so it stays a component.
        exclude: ['**/[A-Z]*.vue'],
        // Every page is in the first bundle, so a redirect never waits on a
        // download with the page it leaves still showing.
        importMode: 'sync',
        dts: 'src/typed-router.d.ts',
      }),
      vue(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    // Matches the `clientUrl` a fresh `nhost init` writes into the backend, so
    // auth redirects back here with nothing configured.
    server: { host: 'localhost', port: 3000, strictPort: true },
  };
});
