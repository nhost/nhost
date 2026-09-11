import { test } from 'vitest';
import getProjectFeaturePagePath from './getProjectFeaturePagePath';

test('should return empty string for project root', () => {
  expect(
    getProjectFeaturePagePath('/orgs/[orgSlug]/projects/[appSubdomain]'),
  ).toBe('');
});

test('should return static feature path for top-level pages', () => {
  expect(
    getProjectFeaturePagePath('/orgs/[orgSlug]/projects/[appSubdomain]/logs'),
  ).toBe('/logs');
});

test('should return full path for nested static pages', () => {
  expect(
    getProjectFeaturePagePath(
      '/orgs/[orgSlug]/projects/[appSubdomain]/auth/settings',
    ),
  ).toBe('/auth/settings');
});

test('should truncate at the first dynamic segment after appSubdomain', () => {
  expect(
    getProjectFeaturePagePath(
      '/orgs/[orgSlug]/projects/[appSubdomain]/events/cron-triggers/[cronTriggerSlug]',
    ),
  ).toBe('/events/cron-triggers');
});

test('should truncate at the first dynamic segment for database paths', () => {
  expect(
    getProjectFeaturePagePath(
      '/orgs/[orgSlug]/projects/[appSubdomain]/database/browser/[dataSourceSlug]/[schemaSlug]/tables/[tableSlug]',
    ),
  ).toBe('/database/browser');
});

test('should truncate at the first dynamic segment for deployments', () => {
  expect(
    getProjectFeaturePagePath(
      '/orgs/[orgSlug]/projects/[appSubdomain]/deployments/[deploymentId]',
    ),
  ).toBe('/deployments');
});

test('should truncate at the first dynamic segment for remote schemas', () => {
  expect(
    getProjectFeaturePagePath(
      '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/remote-schemas/[remoteSchemaSlug]',
    ),
  ).toBe('/graphql/remote-schemas');
});

test('should return /storage/buckets when on a bucket detail page', () => {
  expect(
    getProjectFeaturePagePath(
      '/orgs/[orgSlug]/projects/[appSubdomain]/storage/buckets/[...bucketId]',
    ),
  ).toBe('/storage/buckets');
});

test('should return /functions/browser when on a function detail page', () => {
  expect(
    getProjectFeaturePagePath(
      '/orgs/[orgSlug]/projects/[appSubdomain]/functions/browser/[...functionSlug]',
    ),
  ).toBe('/functions/browser');
});

test('should return /database/schema/default when on the schema navigator page', () => {
  expect(
    getProjectFeaturePagePath(
      '/orgs/[orgSlug]/projects/[appSubdomain]/database/schema/[dataSourceSlug]',
    ),
  ).toBe('/database/schema/default');
});

test('should return /database/native-queries/default when on a native queries page', () => {
  expect(
    getProjectFeaturePagePath(
      '/orgs/[orgSlug]/projects/[appSubdomain]/database/native-queries/[dataSourceSlug]/queries/[querySlug]',
    ),
  ).toBe('/database/native-queries/default');
});

test('should return /database/console/default when on the SQL console page', () => {
  expect(
    getProjectFeaturePagePath(
      '/orgs/[orgSlug]/projects/[appSubdomain]/database/console/[dataSourceSlug]',
    ),
  ).toBe('/database/console/default');
});
