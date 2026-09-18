const baseProjectPageRoute = '/orgs/[orgSlug]/projects/[appSubdomain]/';

function toRoutes(pages: string[]): Set<string> {
  return new Set(pages.map((page) => baseProjectPageRoute.concat(page)));
}

const runningProjectPages = toRoutes([
  'database',
  'database/browser/[dataSourceSlug]',
  'database/browser/[dataSourceSlug]/editor',
  'database/browser/[dataSourceSlug]/[schemaSlug]/tables/[tableSlug]',
  'database/browser/[dataSourceSlug]/[schemaSlug]/functions/[functionOID]',
  'database/schema/[dataSourceSlug]',
  'database/backups',
  'database/backups/import',
  'database/backups/point-in-time',
  'graphql',
  'graphql/remote-schemas',
  'graphql/remote-schemas/[remoteSchemaSlug]',
  'graphql/actions',
  'graphql/actions/[actionSlug]',
  'graphql/actions/custom-types',
  'graphql/metadata',
  'events/event-triggers',
  'events/event-triggers/[eventTriggerSlug]',
  'events/cron-triggers',
  'events/cron-triggers/[cronTriggerSlug]',
  'events/one-offs',
  'hasura',
  'auth/users',
  'auth/oauth2-clients',
  'storage',
  'storage/bucket/[...bucketId]',
  'ai/auto-embeddings',
  'ai/assistants',
  'ai/file-stores',
  'functions',
  'functions/[...functionSlug]',
  'run',
  'metrics',
]);

/**
 * Whether the given route only works when the project's services are running,
 * so it should be replaced with a project-state screen while the project is
 * paused/pausing/unpausing/restoring.
 */
export function requiresRunningProject(route: string): boolean {
  return runningProjectPages.has(route);
}
