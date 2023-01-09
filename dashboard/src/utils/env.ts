/**
 * URL of Hasura's Migration API. This is only used when local development is
 * enabled.
 */
export function getLocalMigrationsUrl() {
  return `http://localhost:${
    process.env.NEXT_PUBLIC_NHOST_LOCAL_MIGRATIONS_PORT || 9693
  }`;
}

/**
 * Port of the locally running backend.
 */
export function getLocalBackendPort() {
  return process.env.NEXT_PUBLIC_NHOST_LOCAL_BACKEND_PORT;
}

/**
 * Subdomain of the Nhost project.
 */
export function getSubdomain() {
  const subdomain = process.env.NEXT_PUBLIC_NHOST_LOCAL_SUBDOMAIN;

  if (!subdomain || subdomain === 'localhost') {
    return 'localhost';
  }

  return subdomain;
}

/**
 * Local subdomain. This is only used when local development is enabled.
 */
export function getLocalSubdomain() {
  const localBackendPort = getLocalBackendPort();
  const subdomain = getSubdomain();

  if (!localBackendPort) {
    return subdomain;
  }

  return `${subdomain}:${localBackendPort}`;
}

/**
 * URL of Hasura Console. This is only used when running the Nhost Dashboard
 * locally.
 */
export function getLocalHasuraConsoleUrl() {
  return `http://localhost:${
    process.env.NEXT_PUBLIC_NHOST_LOCAL_HASURA_PORT || 9695
  }`;
}

/**
 * Backend URL for the locally running instance. This is only used when running
 * the Nhost Dashboard locally.
 */
export function getLocalBackendUrl() {
  return `http://localhost:${
    process.env.NEXT_PUBLIC_NHOST_LOCAL_BACKEND_PORT || 1337
  }`;
}
