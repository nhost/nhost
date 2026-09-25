import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { NextRouter } from 'next/router';
import { vi } from 'vitest';
import { BillingUsageTab } from '@/features/orgs/components/billing/BillingTabs/components/BillingUsageTab';
import { Organization_Members_Role_Enum } from '@/generated/graphql';
import {
  mockApplication,
  mockOrganization,
  mockRouter,
  mockSession,
} from '@/tests/mocks';
import { billingMetricsQuery } from '@/tests/msw/mocks/graphql/billingMetricsQuery';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import { queryClient, render, screen } from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

const server = setupServer();

const organizationHandler = nhostGraphQLLink.query('getOrganization', () =>
  HttpResponse.json({
    data: {
      organizations: [
        {
          ...mockOrganization,
          members: [
            {
              id: 'member-1',
              role: Organization_Members_Role_Enum.Admin,
              user: {
                id: mockSession.user?.id,
                email: 'admin@example.com',
                displayName: 'Admin',
                avatarUrl: '',
                __typename: 'users',
              },
              __typename: 'organization_members',
            },
          ],
        },
      ],
    },
  }),
);

beforeAll(() => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_ENV = 'production';
  server.listen();
});

beforeEach(() => {
  mocks.useRouter.mockReturnValue({
    ...mockRouter,
    pathname: '/orgs/[orgSlug]/billing',
    route: '/orgs/[orgSlug]/billing',
    asPath: '/orgs/xyz/billing?tab=usage&source=settings',
    query: { orgSlug: 'xyz', tab: 'usage', source: 'settings' },
    replace: vi.fn(),
  } satisfies NextRouter);
  server.use(
    organizationHandler,
    billingMetricsQuery({
      projects: [{ id: mockApplication.id, name: mockApplication.name }],
      now: new Date(),
    }),
  );
});

afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
});

describe('BillingUsageTab', () => {
  it('renders the real metrics surface for a paid organization admin', async () => {
    render(<BillingUsageTab />);

    expect(
      await screen.findByRole('region', { name: 'Usage by project' }),
    ).toBeInTheDocument();
  });
});
