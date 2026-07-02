/**
 * Determines whether the Nhost Dashboard is running in a cloud environment.
 */
export function isPlatform() {
  return process.env.NEXT_PUBLIC_NHOST_PLATFORM === 'true';
}

/**
 * Admin secret for Hasura.
 */
export function getHasuraAdminSecret() {
  return process.env.NEXT_PUBLIC_NHOST_ADMIN_SECRET || 'nhost-admin-secret';
}

/**
 * Custom URL of the Auth service.
 */
export function getAuthServiceUrl() {
  return (
    process.env.NEXT_PUBLIC_NHOST_AUTH_URL ||
    'https://local.auth.local.nhost.run/v1'
  );
}

/**
 * Custom URL of the Database service.
 */
export function getDatabaseServiceUrl() {
  return (
    process.env.NEXT_PUBLIC_NHOST_DATABASE_URL || 'local.db.local.nhost.run'
  );
}

/**
 * Custom URL of the GraphQL service.
 */
export function getGraphqlServiceUrl() {
  return (
    process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL ||
    'https://local.graphql.local.nhost.run/v1'
  );
}

/**
 * Custom URL of the Storage service.
 */
export function getStorageServiceUrl() {
  return (
    process.env.NEXT_PUBLIC_NHOST_STORAGE_URL ||
    'https://local.storage.local.nhost.run/v1'
  );
}

/**
 * Custom URL of the Functions service.
 */
export function getFunctionsServiceUrl() {
  return (
    process.env.NEXT_PUBLIC_NHOST_FUNCTIONS_URL ||
    'https://local.functions.local.nhost.run/v1'
  );
}

/**
 * Custom URL of the AI service.
 */
export function getAiServiceUrl() {
  return (
    process.env.NEXT_PUBLIC_NHOST_AI_URL ||
    'https://local.ai.local.nhost.run/v1'
  );
}

/**
 * Custom URL of the Hasura service.
 */
export function getHasuraConsoleServiceUrl() {
  return (
    process.env.NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL ||
    'https://local.hasura.local.nhost.run'
  );
}

/**
 * Custom URL of the Hasura Migrations API.
 */
export function getHasuraMigrationsApiUrl() {
  return (
    process.env.NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL ||
    'https://local.hasura.local.nhost.run/apis/migrate'
  );
}

/**
 * Custom URL of the Hasura Schema and Metadata API.
 */
export function getHasuraApiUrl() {
  return (
    process.env.NEXT_PUBLIC_NHOST_HASURA_API_URL ||
    'https://local.hasura.local.nhost.run'
  );
}

/**
 * Custom URL of the config service.
 */
export function getConfigServerUrl() {
  return process.env.NEXT_PUBLIC_NHOST_CONFIGSERVER_URL;
}

/**
 * Custom URL of the Logs GraphQL service for the local dashboard.
 */
export function getGraphqlLogsServiceUrl() {
  return (
    process.env.NEXT_PUBLIC_NHOST_LOGS_GRAPHQL_URL ||
    'https://local.dashboard.local.nhost.run/v1/logs/graphql'
  );
}

/**
 * Custom WebSocket URL of the Logs service for the local dashboard.
 */
export function getLogsWebsocketUrl() {
  return (
    process.env.NEXT_PUBLIC_NHOST_LOGS_WEBSOCKET ||
    'wss://local.dashboard.local.nhost.run/v1/logs/graphql'
  );
}

/**
 * Returns the current version of the dashboard.
 */
export function getDashboardVersion() {
  return process.env.NEXT_PUBLIC_DASHBOARD_VERSION || '0.0.0-dev';
}

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * App ID used by the local dashboard to talk to the CLI-managed configserver.
 * The CLI generates and persists this UUID per project; the value is
 * substituted into the Docker image at runtime by docker-entrypoint.sh. When
 * the value is missing or has not been substituted (e.g. older CLI), we fall
 * back to the legacy all-zeros UUID.
 */
export function getLocalAppId() {
  const appId = process.env.NEXT_PUBLIC_NHOST_APP_ID;

  if (!appId || appId.startsWith('__')) {
    return ZERO_UUID;
  }

  return appId;
}
