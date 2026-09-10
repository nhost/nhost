import {
  hasSidebarSkeleton,
  requiresRunningProject,
} from './projectStatePages';

const base = '/orgs/[orgSlug]/projects/[appSubdomain]';

describe('requiresRunningProject', () => {
  it.each([
    `${base}/database/browser/[dataSourceSlug]`,
    `${base}/database/browser/[dataSourceSlug]/editor`,
    `${base}/database/browser/[dataSourceSlug]/[schemaSlug]/tables/[tableSlug]`,
    `${base}/database/browser/[dataSourceSlug]/[schemaSlug]/functions/[functionOID]`,
    `${base}/database/schema/[dataSourceSlug]`,
  ])('blocks %s', (route) => {
    expect(requiresRunningProject(route)).toBe(true);
  });

  it.each([
    `${base}/database/backups`,
    `${base}/database/backups/point-in-time`,
    `${base}/database/backups/import`,
    `${base}/database/settings`,
  ])('leaves %s reachable while the project is paused', (route) => {
    expect(requiresRunningProject(route)).toBe(false);
  });
});

describe('hasSidebarSkeleton', () => {
  it('skeletons a sidebar only for blocked pages that have one', () => {
    expect(
      hasSidebarSkeleton(
        `${base}/database/browser/[dataSourceSlug]/[schemaSlug]/tables/[tableSlug]`,
      ),
    ).toBe(true);
    expect(
      hasSidebarSkeleton(`${base}/database/browser/[dataSourceSlug]/editor`),
    ).toBe(false);
    expect(hasSidebarSkeleton(`${base}/database/schema/[dataSourceSlug]`)).toBe(
      false,
    );
  });
});
