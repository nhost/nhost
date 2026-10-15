/**
 * Maps computed feature paths that are not valid navigable pages to their
 * actual parent page. This is needed when a dynamic route's direct parent
 * segment is not a list page (e.g. `/database/schema` has no index, only
 * `/database/schema/default` does).
 */
const featurePathOverrides: Record<string, string> = {
  '/database/schema': '/database/schema/default',
  '/database/native-queries': '/database/native-queries/default',
  '/database/console': '/database/console/default',
};

/**
 * Extracts the dashboard feature page's path from a route's full path,
 * stripping any dynamic segments after `$appSubdomain`.
 *
 * For example, given
 * `/orgs/$orgSlug/projects/$appSubdomain/events/cron-triggers/$cronTriggerSlug`,
 * it returns `/events/cron-triggers`.
 */
export default function getProjectFeaturePagePath(pagePath: string): string {
  const afterProject = (pagePath.split('$appSubdomain')[1] || '').replace(
    /\/$/,
    '',
  );
  const firstDynamic = afterProject.indexOf('$');

  if (firstDynamic === -1) {
    return afterProject;
  }

  const computed = afterProject.substring(
    0,
    afterProject.lastIndexOf('/', firstDynamic),
  );
  return featurePathOverrides[computed] ?? computed;
}
