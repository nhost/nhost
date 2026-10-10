import {
  hasSidebarSkeleton,
  requiresRunningProject,
} from '@/features/orgs/guards/ProjectStateGate/projectStatePages';

const base = '/orgs/[orgSlug]/projects/[appSubdomain]';

describe('requiresRunningProject', () => {
  it.each([
    `${base}/database/browser/[dataSourceSlug]`,
    `${base}/database/console/[dataSourceSlug]`,
    `${base}/database/browser/[dataSourceSlug]/[schemaSlug]/tables/[tableSlug]`,
    `${base}/database/browser/[dataSourceSlug]/[schemaSlug]/functions/[functionOID]`,
    `${base}/database/schema/[dataSourceSlug]`,
    `${base}/database/native-queries/[dataSourceSlug]`,
    `${base}/database/native-queries/[dataSourceSlug]/models/[modelSlug]`,
    `${base}/database/native-queries/[dataSourceSlug]/queries/[querySlug]`,
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
  it.each([
    `${base}/database/browser/[dataSourceSlug]`,
    `${base}/database/browser/[dataSourceSlug]/[schemaSlug]/tables/[tableSlug]`,
    `${base}/database/browser/[dataSourceSlug]/[schemaSlug]/functions/[functionOID]`,
    `${base}/database/native-queries/[dataSourceSlug]`,
    `${base}/database/native-queries/[dataSourceSlug]/models/[modelSlug]`,
    `${base}/database/native-queries/[dataSourceSlug]/queries/[querySlug]`,
  ])('skeletons the sidebar for %s', (route) => {
    expect(hasSidebarSkeleton(route)).toBe(true);
  });

  it('does not skeleton pages without a sidebar', () => {
    expect(
      hasSidebarSkeleton(`${base}/database/console/[dataSourceSlug]`),
    ).toBe(false);
    expect(hasSidebarSkeleton(`${base}/database/schema/[dataSourceSlug]`)).toBe(
      false,
    );
  });
});
