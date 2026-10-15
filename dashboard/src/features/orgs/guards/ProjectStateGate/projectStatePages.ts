import type { FileRoutesByFullPath } from '@/routeTree.gen';

/** A project page, by its route's full path (index routes end with `/`). */
type ProjectPagePath = Extract<
  keyof FileRoutesByFullPath,
  `/orgs/$orgSlug/projects/$appSubdomain/${string}`
>;

const runningProjectPages = new Set<string>([
  '/orgs/$orgSlug/projects/$appSubdomain/database/browser/$dataSourceSlug/',
  '/orgs/$orgSlug/projects/$appSubdomain/database/console/$dataSourceSlug',
  '/orgs/$orgSlug/projects/$appSubdomain/database/browser/$dataSourceSlug/$schemaSlug/tables/$tableSlug',
  '/orgs/$orgSlug/projects/$appSubdomain/database/browser/$dataSourceSlug/$schemaSlug/functions/$functionOID',
  '/orgs/$orgSlug/projects/$appSubdomain/database/schema/$dataSourceSlug',
  '/orgs/$orgSlug/projects/$appSubdomain/database/native-queries/$dataSourceSlug/',
  '/orgs/$orgSlug/projects/$appSubdomain/database/native-queries/$dataSourceSlug/models/$modelSlug',
  '/orgs/$orgSlug/projects/$appSubdomain/database/native-queries/$dataSourceSlug/queries/$querySlug',
  '/orgs/$orgSlug/projects/$appSubdomain/graphql/',
  '/orgs/$orgSlug/projects/$appSubdomain/graphql/remote-schemas/',
  '/orgs/$orgSlug/projects/$appSubdomain/graphql/remote-schemas/$remoteSchemaSlug',
  '/orgs/$orgSlug/projects/$appSubdomain/graphql/actions/',
  '/orgs/$orgSlug/projects/$appSubdomain/graphql/actions/$actionSlug',
  '/orgs/$orgSlug/projects/$appSubdomain/graphql/actions/custom-types',
  '/orgs/$orgSlug/projects/$appSubdomain/graphql/metadata/',
  '/orgs/$orgSlug/projects/$appSubdomain/events/event-triggers/',
  '/orgs/$orgSlug/projects/$appSubdomain/events/event-triggers/$eventTriggerSlug',
  '/orgs/$orgSlug/projects/$appSubdomain/events/cron-triggers/',
  '/orgs/$orgSlug/projects/$appSubdomain/events/cron-triggers/$cronTriggerSlug',
  '/orgs/$orgSlug/projects/$appSubdomain/events/one-offs/',
  '/orgs/$orgSlug/projects/$appSubdomain/graphql/console',
  '/orgs/$orgSlug/projects/$appSubdomain/auth/users',
  '/orgs/$orgSlug/projects/$appSubdomain/auth/oauth2-clients',
  '/orgs/$orgSlug/projects/$appSubdomain/storage/buckets/',
  '/orgs/$orgSlug/projects/$appSubdomain/storage/buckets/$',
  '/orgs/$orgSlug/projects/$appSubdomain/ai/auto-embeddings/',
  '/orgs/$orgSlug/projects/$appSubdomain/ai/assistants/',
  '/orgs/$orgSlug/projects/$appSubdomain/ai/file-stores/',
  '/orgs/$orgSlug/projects/$appSubdomain/metrics/',
] satisfies ProjectPagePath[]);

const sidebarSkeletonPages = new Set<string>([
  '/orgs/$orgSlug/projects/$appSubdomain/events/event-triggers/',
  '/orgs/$orgSlug/projects/$appSubdomain/events/event-triggers/$eventTriggerSlug',
  '/orgs/$orgSlug/projects/$appSubdomain/events/cron-triggers/',
  '/orgs/$orgSlug/projects/$appSubdomain/events/cron-triggers/$cronTriggerSlug',
  '/orgs/$orgSlug/projects/$appSubdomain/storage/buckets/',
  '/orgs/$orgSlug/projects/$appSubdomain/storage/buckets/$',
  '/orgs/$orgSlug/projects/$appSubdomain/graphql/remote-schemas/',
  '/orgs/$orgSlug/projects/$appSubdomain/graphql/remote-schemas/$remoteSchemaSlug',
  '/orgs/$orgSlug/projects/$appSubdomain/graphql/actions/',
  '/orgs/$orgSlug/projects/$appSubdomain/graphql/actions/$actionSlug',
  '/orgs/$orgSlug/projects/$appSubdomain/graphql/actions/custom-types',
  '/orgs/$orgSlug/projects/$appSubdomain/database/browser/$dataSourceSlug/',
  '/orgs/$orgSlug/projects/$appSubdomain/database/browser/$dataSourceSlug/$schemaSlug/tables/$tableSlug',
  '/orgs/$orgSlug/projects/$appSubdomain/database/browser/$dataSourceSlug/$schemaSlug/functions/$functionOID',
  '/orgs/$orgSlug/projects/$appSubdomain/database/native-queries/$dataSourceSlug/',
  '/orgs/$orgSlug/projects/$appSubdomain/database/native-queries/$dataSourceSlug/models/$modelSlug',
  '/orgs/$orgSlug/projects/$appSubdomain/database/native-queries/$dataSourceSlug/queries/$querySlug',
] satisfies ProjectPagePath[]);

/**
 * Whether the given page only works when the project's services are running,
 * so it should be replaced with a project-state screen while the project is
 * paused/pausing/unpausing/restoring.
 */
export function requiresRunningProject(pagePath: string | undefined): boolean {
  return pagePath !== undefined && runningProjectPages.has(pagePath);
}

/**
 * Whether the project-state screen's skeleton should include a sidebar for the
 * given page. Only pages whose sidebar loads its contents from the project
 * qualify — a static link sidebar has nothing to stand in for.
 */
export function hasSidebarSkeleton(pagePath: string | undefined): boolean {
  return pagePath !== undefined && sidebarSkeletonPages.has(pagePath);
}
