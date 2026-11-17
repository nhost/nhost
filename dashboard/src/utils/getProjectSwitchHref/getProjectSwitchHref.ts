import { getProjectFeaturePagePath } from '@/utils/getProjectFeaturePagePath';

interface ProjectSwitchTarget {
  /**
   * The current Next.js route template, e.g.
   * `/orgs/[orgSlug]/projects/[appSubdomain]/settings`.
   */
  pathname: string;
  /** The current `tab` query param, if any. */
  tab?: string;
  orgSlug: string;
  subdomain: string;
}

/**
 * The URL of the current feature page in another project. A tab only applies
 * to the page it was set on, so it is dropped when a dynamic segment was
 * stripped (e.g. switching from a function detail page lands on the functions
 * list).
 */
export default function getProjectSwitchHref({
  pathname,
  tab,
  orgSlug,
  subdomain,
}: ProjectSwitchTarget): string {
  const isSamePage = !pathname.split('[appSubdomain]')[1]?.includes('[');
  const search =
    tab && isSamePage ? `?${new URLSearchParams({ tab }).toString()}` : '';

  return `/orgs/${orgSlug}/projects/${subdomain}${getProjectFeaturePagePath(pathname)}${search}`;
}
