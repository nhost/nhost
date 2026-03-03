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

  return afterProject.substring(0, afterProject.lastIndexOf('/', firstDynamic));
}
