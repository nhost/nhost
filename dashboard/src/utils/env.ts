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
 * Port of the migration service exposed by Hasura.
 */
export function getLocalHasuraMigrationsPort() {
  return process.env.NEXT_PUBLIC_NHOST_LOCAL_MIGRATIONS_PORT || '9693';
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
  return process.env.NEXT_PUBLIC_NHOST_LOCAL_SUBDOMAIN || 'localdev';
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
 * URL of Hasura's Migrations API. This is only used when running the Nhost
 * Dashboard locally.
 */
export function getLocalHasuraMigrationServiceUrl() {
  return `http://localhost:${getLocalHasuraMigrationsPort()}`;
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
