import {
  hasSidebarSkeleton,
  requiresRunningProject,
} from '@/features/orgs/layout/OrgLayout/projectStatePages';

describe('native-query project-state routes', () => {
  it.each([
    '/orgs/[orgSlug]/projects/[appSubdomain]/database/native-queries/[dataSourceSlug]',
    '/orgs/[orgSlug]/projects/[appSubdomain]/database/native-queries/[dataSourceSlug]/models/[modelSlug]',
    '/orgs/[orgSlug]/projects/[appSubdomain]/database/native-queries/[dataSourceSlug]/queries/[querySlug]',
  ])('requires running services and a sidebar skeleton for %s', (route) => {
    expect(requiresRunningProject(route)).toBe(true);
    expect(hasSidebarSkeleton(route)).toBe(true);
  });

  it.each([
    '/orgs/[orgSlug]/projects/[appSubdomain]',
    '/orgs/[orgSlug]/projects/[appSubdomain]/settings/database',
    '/orgs/[orgSlug]/projects/[appSubdomain]/database/native-queries/[dataSourceSlug]/unknown',
  ])('does not block unrelated or unregistered routes: %s', (route) => {
    expect(requiresRunningProject(route)).toBe(false);
    expect(hasSidebarSkeleton(route)).toBe(false);
  });
});
