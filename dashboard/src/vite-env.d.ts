/// <reference types="vite/client" />

// Variables exposed to the browser through `envPrefix: 'NEXT_PUBLIC_'` in
// vite.config.mts. They keep their Next.js-era names so existing `.env.local`
// files, Vercel settings and the CLI's compose configuration work unchanged.
interface ImportMetaEnv {
  readonly NEXT_PUBLIC_ANALYTICS_WRITE_KEY?: string;
  readonly NEXT_PUBLIC_DASHBOARD_VERSION?: string;
  readonly NEXT_PUBLIC_DISCORD_LOGGING?: string;
  readonly NEXT_PUBLIC_ENV?: string;
  readonly NEXT_PUBLIC_GITHUB_APP_INSTALL_URL?: string;
  readonly NEXT_PUBLIC_NHOST_ADMIN_SECRET?: string;
  readonly NEXT_PUBLIC_NHOST_APP_ID?: string;
  readonly NEXT_PUBLIC_NHOST_AUTH_URL?: string;
  readonly NEXT_PUBLIC_NHOST_BRAGI_WEBSOCKET?: string;
  readonly NEXT_PUBLIC_NHOST_CONFIGSERVER_URL?: string;
  readonly NEXT_PUBLIC_NHOST_DATABASE_URL?: string;
  readonly NEXT_PUBLIC_NHOST_FUNCTIONS_URL?: string;
  readonly NEXT_PUBLIC_NHOST_GRAPHQL_URL?: string;
  readonly NEXT_PUBLIC_NHOST_HASURA_API_URL?: string;
  readonly NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL?: string;
  readonly NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL?: string;
  readonly NEXT_PUBLIC_NHOST_LOGS_GRAPHQL_URL?: string;
  readonly NEXT_PUBLIC_NHOST_LOGS_WEBSOCKET?: string;
  readonly NEXT_PUBLIC_NHOST_PLATFORM?: string;
  readonly NEXT_PUBLIC_NHOST_STORAGE_URL?: string;
  readonly NEXT_PUBLIC_SOC2_REPORT_FILE_ID?: string;
  readonly NEXT_PUBLIC_STRIPE_PK?: string;
  readonly NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
