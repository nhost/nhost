import {
  getAuthServiceUrl,
  getDatabaseServiceUrl,
  getFunctionsServiceUrl,
  getGraphqlServiceUrl,
  getHasuraApiUrl,
  getStorageServiceUrl,
  isPlatform,
} from '@/utils/env';
import type { ProjectFragment } from '@/utils/__generated__/graphql';

export type NhostService =
  | 'auth'
  | 'db'
  | 'graphql'
  | 'functions'
  | 'storage'
  | 'hasura'
  | 'grafana';

/**
 * The default slugs that are used when running the dashboard locally. These
 * values are used both in local mode and when running the dashboard locally
 * against the remote (either staging or production) backend.
 */
export const defaultLocalBackendSlugs: Record<NhostService, string> = {
  auth: '/v1/auth',
  db: '',
  graphql: '/v1/graphql',
  functions: '/v1/functions',
  storage: '/v1/files',
  hasura: '',
  grafana: '',
};

/**
 * The default slugs that are used when running the dashboard against the
 * remote (either staging or production) backend in a cloud environment.
 */
export const defaultRemoteBackendSlugs: Record<NhostService, string> = {
  auth: '/v1',
  db: '',
  graphql: '/v1',
  functions: '/v1',
  storage: '/v1',
  hasura: '',
  grafana: '',
};

/**
 * Generates a service specific URL for a project. Provided `subdomain` is
 * omitted if the dashboard is running in local mode.
 *
 * @param subdomain - The project's subdomain
 * @param region - The project's region
 * @param service - The service to generate the URL for
 * @param localBackendSlugs - Custom slugs to be used when running the dashboard locally
 * @param localBackendSlugs - Custom slugs to be used when running the dashboard in a cloud environment
 * @returns The service specific URL for the project
 */
export default function generateAppServiceUrl(
  subdomain: string,
  region: ProjectFragment['region'],
  service: NhostService,
  remoteBackendSlugs = defaultRemoteBackendSlugs,
) {
  const IS_PLATFORM = isPlatform();

  if (!IS_PLATFORM) {
    const serviceUrls: Record<typeof service, string> = {
      auth: getAuthServiceUrl(),
      db: getDatabaseServiceUrl(),
      graphql: getGraphqlServiceUrl(),
      storage: getStorageServiceUrl(),
      functions: getFunctionsServiceUrl(),
      hasura: getHasuraApiUrl(),
      grafana: '',
    };

    if (!serviceUrls[service]) {
      throw new Error(
        `Service URL for "${service}" is not defined. Please check your .env file.`,
      );
    }

    return serviceUrls[service];
  }

  const constructedDomain = [
    subdomain,
    service,
    region?.name,
    region?.domain || 'nhost.run',
  ]
    .filter(Boolean)
    .join('.');

  let url = `https://${constructedDomain}${remoteBackendSlugs[service]}`;

  if (service === 'grafana') {
    url = `${url}/dashboards`;
  }

  return url;
}
