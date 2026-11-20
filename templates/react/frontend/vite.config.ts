import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

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
    plugins: [react(), tailwindcss()],
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
