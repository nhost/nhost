/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NHOST_REGION: string | undefined;
  readonly VITE_NHOST_SUBDOMAIN: string | undefined;
  readonly VITE_ENV: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
