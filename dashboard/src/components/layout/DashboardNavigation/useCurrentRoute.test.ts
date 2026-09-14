import { vi } from 'vitest';

import { useCurrentRoute } from '@/components/layout/DashboardNavigation/useCurrentRoute';
import { renderHook } from '@/tests/testUtils';

const router = {
  query: {} as Record<string, string>,
  asPath: '/',
  pathname: '/',
};

vi.mock('next/router', () => ({
  useRouter: () => router,
}));

const setRoute = (
  pathname: string,
  asPath: string,
  query: Record<string, string> = {},
) => {
  router.pathname = pathname;
  router.asPath = asPath;
  router.query = query;
};

describe('useCurrentRoute', () => {
  it('reads the slugs on a project route', () => {
    setRoute(
      '/orgs/[orgSlug]/projects/[appSubdomain]/database',
      '/orgs/org-a/projects/project-a/database',
      { orgSlug: 'org-a', appSubdomain: 'project-a' },
    );

    const { result } = renderHook(() => useCurrentRoute());

    expect(result.current).toEqual({
      orgSlug: 'org-a',
      appSubdomain: 'project-a',
      isOrgRoute: true,
      isProjectRoute: true,
    });
  });

  it('falls back to the path while the query is still empty', () => {
    setRoute(
      '/orgs/[orgSlug]/projects/[appSubdomain]',
      '/orgs/org-a/projects/project-a?tab=general',
    );

    const { result } = renderHook(() => useCurrentRoute());

    expect(result.current.orgSlug).toBe('org-a');
    expect(result.current.appSubdomain).toBe('project-a');
  });

  it('treats the create-project page as an organization route', () => {
    setRoute('/orgs/[orgSlug]/projects/new', '/orgs/org-a/projects/new', {
      orgSlug: 'org-a',
    });

    const { result } = renderHook(() => useCurrentRoute());

    expect(result.current).toEqual({
      orgSlug: 'org-a',
      appSubdomain: undefined,
      isOrgRoute: true,
      isProjectRoute: false,
    });
  });

  it.each([
    '/',
    '/account',
    '/onboarding/project',
    '/support/ticket',
    '/orgs/verify',
  ])('reports no organization at %s', (path) => {
    setRoute(path, path);

    const { result } = renderHook(() => useCurrentRoute());

    expect(result.current).toEqual({
      orgSlug: undefined,
      appSubdomain: undefined,
      isOrgRoute: false,
      isProjectRoute: false,
    });
  });
});
