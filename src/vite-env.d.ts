/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TESTING: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
