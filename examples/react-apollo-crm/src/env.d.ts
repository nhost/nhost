/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NHOST_URL: string;
  // more env variables...
}

// eslint-disable-next-line no-unused-vars
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
