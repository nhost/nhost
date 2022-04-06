/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NHOST_URL: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
