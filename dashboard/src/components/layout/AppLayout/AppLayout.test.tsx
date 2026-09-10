import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useRouter } from 'next/router';
import { vi } from 'vitest';
import AppLayout from '@/components/layout/AppLayout/AppLayout';
import {
  type GetOrganizationQuery,
  type GetOrganizationQueryVariables,
  type GetOrganizationsQuery,
  type GetOrganizationsQueryVariables,
  Sla_Level_Enum,
} from '@/generated/graphql';
import {
  mockMatchMediaValue,
  mockOrganization,
  mockRouter,
} from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { queryClient, render, screen } from '@/tests/testUtils';

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

const storageKey = 'dashboard-sidebar-collapsed';
const originalMatchMedia = window.matchMedia;

const server = setupServer(
  tokenQuery,
  nhostGraphQLLink.query<GetOrganizationsQuery, GetOrganizationsQueryVariables>(
    'getOrganizations',
    () =>
      HttpResponse.json({
        data: {
          organizations: [
            {
              ...mockOrganization,
              apps: [],
              plan: { ...mockOrganization.plan, slaLevel: Sla_Level_Enum.None },
            },
          ],
        },
      }),
  ),
  nhostGraphQLLink.query<GetOrganizationQuery, GetOrganizationQueryVariables>(
    'getOrganization',
    () => HttpResponse.json({ data: { organizations: [mockOrganization] } }),
  ),
  nhostGraphQLLink.query('getAnnouncements', () =>
    HttpResponse.json({ data: { announcements: [] } }),
  ),
  nhostGraphQLLink.query('organizationMemberInvites', () =>
    HttpResponse.json({ data: { organizationMemberInvites: [] } }),
  ),
  nhostGraphQLLink.query('organizationNewRequests', () =>
    HttpResponse.json({ data: { organizationNewRequests: [] } }),
  ),
);

beforeAll(async () => {
  server.listen({ onUnhandledRequest: 'error' });
  // Load the dynamically imported sidebar up front, so the test waits on React
  // rather than on the module's first transform.
  await import('@/components/layout/AppSidebar/AppSidebar');
});

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  vi.mocked(useRouter).mockReturnValue({
    ...mockRouter,
    pathname: '/orgs/[orgSlug]/projects',
    route: '/orgs/[orgSlug]/projects',
    asPath: `/orgs/${mockOrganization.slug}/projects`,
    query: { orgSlug: mockOrganization.slug },
  });
});

afterEach(() => {
  queryClient.clear();
  server.resetHandlers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  window.matchMedia = originalMatchMedia;
  window.localStorage.removeItem(storageKey);
});

afterAll(() => server.close());

describe('AppLayout', () => {
  it('mounts the sidebar after the first render, in its saved collapsed state', async () => {
    window.localStorage.setItem(storageKey, 'true');

    render(
      <AppLayout>
        <h1>Page content</h1>
      </AppLayout>,
    );

    // Absent from the first render, so the prerendered HTML never contains a
    // sidebar whose collapsed state hydration would leave stale.
    expect(
      screen.queryByRole('complementary', { name: 'Organization navigation' }),
    ).not.toBeInTheDocument();

    expect(
      await screen.findByRole('complementary', {
        name: 'Organization navigation',
      }),
    ).toHaveClass('w-[72px]');
    expect(
      screen.getByRole('button', { name: 'Expand sidebar' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
