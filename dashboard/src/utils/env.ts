/**
 * Determines whether the Nhost Dashboard is running in a cloud environment.
 */
export function isPlatform() {
  return process.env.NEXT_PUBLIC_NHOST_PLATFORM === 'true';
}

/**
 * Port of the locally running services exposed by the CLI.
 */
export function getLocalServicesPort() {
  return process.env.NEXT_PUBLIC_NHOST_LOCAL_SERVICES_PORT || '443';
}

/**
 * Port of services exposed by Hasura. For example: Hasura's GraphQL API or the
 * Schema or Metadata API.
 */
export function getLocalHasuraPort() {
  return (
    process.env.NEXT_PUBLIC_NHOST_LOCAL_BACKEND_PORT ||
    process.env.NEXT_PUBLIC_NHOST_LOCAL_GRAPHQL_PORT ||
    '8080'
  );
}

/**
 * Port of Hasura Console.
 */
export function getLocalHasuraConsolePort() {
  return (
    process.env.NEXT_PUBLIC_NHOST_LOCAL_HASURA_CONSOLE_PORT ||
    process.env.NEXT_PUBLIC_NHOST_LOCAL_HASURA_PORT ||
    '9695'
  );
}

/**
 * Subdomain of the Nhost project.
 */
export function getSubdomain() {
  return process.env.NEXT_PUBLIC_NHOST_LOCAL_SUBDOMAIN;
}

/**
 * Local subdomain. This is only used when local development is enabled.
 */
export function getLocalSubdomain() {
  const LOCAL_SERVICES_PORT = getLocalServicesPort();
  const SUBDOMAIN = getSubdomain();

  if (!LOCAL_SERVICES_PORT) {
    return SUBDOMAIN;
  }

  return `${SUBDOMAIN}:${LOCAL_SERVICES_PORT}`;
}

/**
 * URL of Hasura Console. This is only used when running the Nhost Dashboard
 * locally.
 */
export function getLocalHasuraConsoleUrl() {
  return `http://localhost:${getLocalHasuraConsolePort()}`;
}

/**
 * URL of Hasura's GraphQL API. This is only used when running the Nhost
 * Dashboard locally.
 */
export function getLocalHasuraServiceUrl() {
  return `http://localhost:${getLocalHasuraPort()}`;
}

/**
 * Backend URL for the locally running instance. This is only used when running
 * the Nhost Dashboard locally.
 */
export function getLocalBackendUrl() {
  const SUBDOMAIN = getSubdomain();

  if (SUBDOMAIN === 'localhost') {
    return `http://localhost:${getLocalServicesPort()}`;
  }

  return `https://${getLocalSubdomain()}.nhost.run:${getLocalServicesPort()}`;
}

// --------------------------------

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

export function getHasuraMigrationsApiUrl() {
  return process.env.NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL;
}

export function getHasuraSchemaApiUrl() {
  return process.env.NEXT_PUBLIC_NHOST_HASURA_SCHEMA_API_URL;
}

/**
 * Custom URL of the Hasura Migrations API.
 */
// export function getMigrationServiceUrl() {
//   const serviceUrl = getHasuraServiceUrl();
//   const port = getMigrationsApiPort();
//   const suffix = getMigrationsApiSuffix();

//   if (port) {
//     return `${serviceUrl}:${port}${suffix}`;
//   }
//   return `${serviceUrl}${suffix}`;
// }
