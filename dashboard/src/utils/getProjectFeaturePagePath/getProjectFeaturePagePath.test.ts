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
      '/orgs/[orgSlug]/projects/[appSubdomain]/settings/authentication',
    ),
  ).toBe('/settings/authentication');
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

test('should return /storage when on a bucket detail page', () => {
  expect(
    getProjectFeaturePagePath(
      '/orgs/[orgSlug]/projects/[appSubdomain]/storage/bucket/[bucketId]',
    ),
  ).toBe('/storage');
});
