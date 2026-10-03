import type { BackendConfig } from './types';

const LOCAL = 'local';

const subdomainOf = (config: BackendConfig) => config.subdomain || LOCAL;
const regionOf = (config: BackendConfig) => config.region || LOCAL;

/**
 * URL of a service in the local stack, on the same hostname pattern `nhost up`
 * prints: <subdomain>.<service>.local.nhost.run over TLS.
 */
export function localServiceURL(
  service: string,
  config: BackendConfig = {},
): string {
  return `https://${subdomainOf(config)}.${service}.local.nhost.run`;
}

// The three services the toolbar links to, all of them part of `nhost up`.
export function localServiceUrls(config: BackendConfig = {}) {
  return {
    dashboard: localServiceURL('dashboard', config),
    hasura: localServiceURL('hasura', config),
    mailhog: localServiceURL('mailhog', config),
  };
}

/**
 * Whether the app is talking to a local stack.
 *
 * Everything the toolbar links to is part of `nhost up`, so against a real
 * project those hostnames do not resolve. Being a development build is not
 * enough on its own: running the dev server against a deployed backend is an
 * ordinary thing to do, and the toolbar has nothing to offer there.
 */
export function isLocalBackend(config: BackendConfig = {}): boolean {
  return regionOf(config) === LOCAL;
}
