import { useRouter } from 'next/router';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

interface CurrentRoute {
  orgSlug: string;
  appSubdomain: string;
}

/**
 * Query params are empty on the first render after a hard navigation, so the
 * slugs fall back to the path segments.
 */
export function useCurrentRoute(): CurrentRoute {
  const { query, asPath } = useRouter();
  const currentPath = asPath.split(/[?#]/)[0];
  const [, , orgSlugFromPath, , appSubdomainFromPath] = currentPath.split('/');

  return {
    orgSlug: getSingleQueryParam(query.orgSlug) ?? orgSlugFromPath,
    appSubdomain:
      getSingleQueryParam(query.appSubdomain) ?? appSubdomainFromPath,
  };
}
