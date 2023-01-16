/**
 * Determines whether the Nhost Dashboard is running in a cloud environment.
 */
export function isPlatform() {
  return process.env.NEXT_PUBLIC_NHOST_PLATFORM === 'true';
}

/**
 * Backend URL for the locally running instance. This is only used when running
 * the Nhost Dashboard locally.
 */
export function getLocalBackendUrl() {
  return `http://localhost:${
    process.env.NEXT_PUBLIC_NHOST_LOCAL_SERVICES_PORT || '1337'
  }`;
}

/**
 * Admin secret for Hasura.
 */
export function getHasuraAdminSecret() {
  return process.env.NEXT_PUBLIC_NHOST_ADMIN_SECRET || 'nhost-admin-secret';
}

/**
 * Suffix for the migration service exposed by Hasura.
 */
export function getMigrationsApiSuffix() {
  return process.env.NEXT_PUBLIC_NHOST_MIGRATIONS_API_SUFFIX;
}

/**
 * Port of the migration service exposed by Hasura.
 */
export function getMigrationsApiPort() {
  return process.env.NEXT_PUBLIC_NHOST_MIGRATIONS_API_PORT;
}

/**
 * Custom URL of the Auth service.
 */
export function getAuthServiceUrl() {
  return process.env.NEXT_PUBLIC_NHOST_AUTH_URL;
}

/**
 * Custom URL of the GraphQL service.
 */
export function getGraphqlServiceUrl() {
  return process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL;
}

/**
 * Custom URL of the Storage service.
 */
export function getStorageServiceUrl() {
  return process.env.NEXT_PUBLIC_NHOST_STORAGE_URL;
}

/**
 * Custom URL of the Functions service.
 */
export function getFunctionsServiceUrl() {
  return process.env.NEXT_PUBLIC_NHOST_FUNCTIONS_URL;
}

/**
 * Custom URL of the Hasura service.
 */
export function getHasuraConsoleServiceUrl() {
  return process.env.NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL;
}

/**
 * Custom URL of the Hasura Migrations API.
 */
export function getHasuraMigrationsApiUrl() {
  return process.env.NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL;
}

/**
 * Custom URL of the Hasura Schema and Metadata API.
 */
export function getHasuraSchemaApiUrl() {
  return process.env.NEXT_PUBLIC_NHOST_HASURA_SCHEMA_API_URL;
}
