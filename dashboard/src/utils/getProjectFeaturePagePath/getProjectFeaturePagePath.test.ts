import getProjectFeaturePagePath from './getProjectFeaturePagePath';

it('should return empty string for project root', () => {
  expect(
    getProjectFeaturePagePath('/orgs/[orgSlug]/projects/[appSubdomain]'),
  ).toBe('');
});

it('should return static feature path for top-level pages', () => {
  expect(
    getProjectFeaturePagePath('/orgs/[orgSlug]/projects/[appSubdomain]/logs'),
  ).toBe('/logs');
});

it('should return full path for nested static pages', () => {
  expect(
    getProjectFeaturePagePath(
      '/orgs/[orgSlug]/projects/[appSubdomain]/auth/settings',
    ),
  ).toBe('/auth/settings');
});

it('should truncate at the first dynamic segment after appSubdomain', () => {
  expect(
    getProjectFeaturePagePath(
      '/orgs/[orgSlug]/projects/[appSubdomain]/events/cron-triggers/[cronTriggerSlug]',
    ),
  ).toBe('/events/cron-triggers');
});

it('should truncate at the first dynamic segment for deployments', () => {
  expect(
    getProjectFeaturePagePath(
      '/orgs/[orgSlug]/projects/[appSubdomain]/deployments/[deploymentId]',
    ),
  ).toBe('/deployments');
});

it('should truncate at the first dynamic segment for remote schemas', () => {
  expect(
    getProjectFeaturePagePath(
      '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/remote-schemas/[remoteSchemaSlug]',
    ),
  ).toBe('/graphql/remote-schemas');
});

it('should return /storage/buckets when on a bucket detail page', () => {
  expect(
    getProjectFeaturePagePath(
      '/orgs/[orgSlug]/projects/[appSubdomain]/storage/buckets/[...bucketId]',
    ),
  ).toBe('/storage/buckets');
});

it('should return /functions/browser when on a function detail page', () => {
  expect(
    getProjectFeaturePagePath(
      '/orgs/[orgSlug]/projects/[appSubdomain]/functions/browser/[...functionSlug]',
    ),
  ).toBe('/functions/browser');
});

it.each([
  '/orgs/[orgSlug]/projects/[appSubdomain]/database/browser/[dataSourceSlug]',
  '/orgs/[orgSlug]/projects/[appSubdomain]/database/browser/[dataSourceSlug]/[schemaSlug]/tables/[tableSlug]',
  '/orgs/[orgSlug]/projects/[appSubdomain]/database/browser/[dataSourceSlug]/[schemaSlug]/functions/[functionOID]',
])('should return /database/browser/default when on %s', (pathname) => {
  // `/database/browser` itself has no page.
  expect(getProjectFeaturePagePath(pathname)).toBe('/database/browser/default');
});

it.each([
  '/orgs/[orgSlug]/projects/[appSubdomain]/database/native-queries/[dataSourceSlug]',
  '/orgs/[orgSlug]/projects/[appSubdomain]/database/native-queries/[dataSourceSlug]/models/[modelSlug]',
  '/orgs/[orgSlug]/projects/[appSubdomain]/database/native-queries/[dataSourceSlug]/queries/[querySlug]',
])('should return /database/native-queries/default when on %s', (pathname) => {
  // `/database/native-queries` itself has no page.
  expect(getProjectFeaturePagePath(pathname)).toBe(
    '/database/native-queries/default',
  );
});

it('should return /database/schema/default when on the schema navigator page', () => {
  expect(
    getProjectFeaturePagePath(
      '/orgs/[orgSlug]/projects/[appSubdomain]/database/schema/[dataSourceSlug]',
    ),
  ).toBe('/database/schema/default');
});

it('should return /database/console/default when on the SQL console page', () => {
  expect(
    getProjectFeaturePagePath(
      '/orgs/[orgSlug]/projects/[appSubdomain]/database/console/[dataSourceSlug]',
    ),
  ).toBe('/database/console/default');
});
