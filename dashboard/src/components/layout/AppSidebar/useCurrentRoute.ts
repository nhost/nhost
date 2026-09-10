import { useRouter } from 'next/router';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

export interface CurrentRoute {
  /** Current path without query string, hash or trailing slash. */
  currentPath: string;
  orgSlug: string;
  appSubdomain: string;
}

/**
 * Query params are empty on the first render after a hard navigation, so the
 * slugs fall back to the path segments.
 */
export function useCurrentRoute(): CurrentRoute {
  const { query, asPath } = useRouter();
  const currentPath = asPath.split(/[?#]/)[0].replace(/\/$/, '');
  const [, , orgSlugFromPath, , appSubdomainFromPath] = currentPath.split('/');

  return {
    currentPath,
    orgSlug: getSingleQueryParam(query.orgSlug) ?? orgSlugFromPath,
    appSubdomain:
      getSingleQueryParam(query.appSubdomain) ?? appSubdomainFromPath,
  };
}
