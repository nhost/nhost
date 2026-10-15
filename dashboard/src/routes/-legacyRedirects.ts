const PROJECT_PATH = '^/orgs/([^/]+)/projects/([^/]+)';

interface LegacyRedirect {
  source: RegExp;
  /** Receives the regex captures (org slug and subdomain first). */
  destination: (...captures: string[]) => string;
}

function projectRedirect(source: string, destination: string): LegacyRedirect {
  return {
    source: new RegExp(`${PROJECT_PATH}${source}$`),
    destination: (orgSlug, appSubdomain) =>
      `/orgs/${orgSlug}/projects/${appSubdomain}${destination}`,
  };
}

// Old project URLs from before the area-based project layout, mapped to the
// page that now hosts their content.
const legacyRedirects: LegacyRedirect[] = [
  {
    source: /^\/login$/,
    destination: () => '/signin',
  },
  projectRedirect('/database/browser', '/database/browser/default'),

  // Project settings
  projectRedirect(
    '/settings/compute-resources',
    '/settings?tab=compute-resources',
  ),
  projectRedirect(
    '/settings/environment-variables',
    '/settings?tab=environment-variables',
  ),
  projectRedirect('/settings/secrets', '/settings?tab=secrets'),
  projectRedirect('/settings/editor', '/settings?tab=editor'),

  // Auth
  projectRedirect(
    '/settings/sign-in-methods',
    '/auth/settings?tab=sign-in-methods',
  ),
  projectRedirect(
    '/settings/oauth2-provider',
    '/auth/settings?tab=oauth2-provider',
  ),
  projectRedirect('/settings/smtp', '/auth/settings?tab=smtp'),
  projectRedirect(
    '/settings/authentication',
    '/auth/settings?tab=authentication',
  ),
  projectRedirect(
    '/settings/roles-and-permissions',
    '/auth/settings?tab=roles-and-permissions',
  ),
  projectRedirect('/settings/jwt', '/auth/settings?tab=jwt'),
  // Custom domains and rate limiting were split across the area settings
  // pages; Auth was the first section on both old pages.
  projectRedirect(
    '/settings/custom-domains',
    '/auth/settings?tab=custom-domain',
  ),
  projectRedirect(
    '/settings/rate-limiting',
    '/auth/settings?tab=rate-limiting',
  ),

  // Database
  projectRedirect('/settings/database', '/database/settings'),
  projectRedirect('/backups', '/database/backups'),
  {
    source: new RegExp(`${PROJECT_PATH}/database/browser/([^/]+)/editor$`),
    destination: (orgSlug, appSubdomain, dataSourceSlug) =>
      `/orgs/${orgSlug}/projects/${appSubdomain}/database/console/${dataSourceSlug}`,
  },

  // GraphQL
  projectRedirect('/hasura', '/graphql/console'),
  projectRedirect('/settings/hasura', '/graphql/settings'),

  // Storage
  projectRedirect('/storage', '/storage/buckets'),
  {
    source: new RegExp(`${PROJECT_PATH}/storage/bucket(/.*)?$`),
    destination: (orgSlug, appSubdomain, bucketPath = '') =>
      `/orgs/${orgSlug}/projects/${appSubdomain}/storage/buckets${bucketPath}`,
  },
  projectRedirect('/settings/storage', '/storage/settings'),

  // Functions
  projectRedirect('/functions', '/functions/browser'),
  // `browser` and `settings` are the new subpages and must not be redirected.
  {
    source: new RegExp(
      `${PROJECT_PATH}/functions/((?!browser(?:/|$)|settings$).+)$`,
    ),
    destination: (orgSlug, appSubdomain, functionSlug) =>
      `/orgs/${orgSlug}/projects/${appSubdomain}/functions/browser/${functionSlug}`,
  },

  // Other area settings
  projectRedirect('/settings/ai', '/ai/settings'),
  projectRedirect('/settings/deployments', '/deployments/settings'),
  projectRedirect('/settings/metrics', '/metrics/settings'),
];

/**
 * Returns the URL an old dashboard URL moved to, or `null` if `pathname` is
 * not a legacy URL. The incoming query string is merged into the
 * destination's; destination params win on conflicts.
 */
export function getLegacyRedirect(
  pathname: string,
  searchStr: string,
): string | null {
  const normalizedPathname =
    pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  for (const { source, destination } of legacyRedirects) {
    const match = source.exec(normalizedPathname);

    if (!match) {
      continue;
    }

    const target = destination(...match.slice(1));
    const [targetPath, targetSearch = ''] = target.split('?');
    const search = new URLSearchParams(searchStr);

    for (const [key, value] of new URLSearchParams(targetSearch)) {
      search.set(key, value);
    }

    const query = search.toString();

    return query ? `${targetPath}?${query}` : targetPath;
  }

  return null;
}
