/**
 * Maps computed feature paths that are not valid navigable pages to their
 * actual parent page. This is needed when a dynamic route's direct parent
 * segment is not a list page (e.g. `/storage/bucket` has no index, only
 * `/storage` does).
 */
const featurePathOverrides: Record<string, string> = {
  '/storage/bucket': '/storage',
};

/**
 * Extracts the dashboard feature page's path from a Next.js route pathname,
 * stripping any dynamic segments after `[appSubdomain]`.
 *
 * For example, given a pathname like
 * `/orgs/[orgSlug]/projects/[appSubdomain]/events/cron-triggers/[cronTriggerSlug]`,
 * it returns `/events/cron-triggers`.
 */
export default function getProjectFeaturePagePath(pathname: string): string {
  const afterProject = pathname.split('[appSubdomain]')[1] || '';
  const firstDynamic = afterProject.indexOf('[');

  if (firstDynamic === -1) {
    return afterProject;
  }

  const computed = afterProject.substring(
    0,
    afterProject.lastIndexOf('/', firstDynamic),
  );
  return featurePathOverrides[computed] ?? computed;
}
