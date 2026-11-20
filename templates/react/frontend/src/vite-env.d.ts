// Set at build time and written into the bundle; read them through
// src/lib/nhost/env.ts.
interface ImportMetaEnv {
  readonly VITE_NHOST_SUBDOMAIN?: string;
  readonly VITE_NHOST_REGION?: string;
  readonly VITE_APP_ORIGIN?: string;
  readonly VITE_NHOST_OAUTH_PROVIDERS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
