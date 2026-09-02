import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { NextRouter } from 'next/router';
import { vi } from 'vitest';
import { BillingUsageTab } from '@/features/orgs/components/billing/BillingTabs/components/BillingUsageTab';
import { Organization_Members_Role_Enum } from '@/generated/graphql';
import { mockOrganization, mockRouter, mockSession } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import { queryClient, render, screen, TestUserEvent } from '@/tests/testUtils';

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
  server.use(organizationHandler);
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
  it('preserves unrelated query values when a free organization upgrades', async () => {
    const user = new TestUserEvent();
    render(<BillingUsageTab isPaidOrg={false} />);

    expect(
      screen.getByRole('region', {
        name: 'Billing usage is available on paid plans',
      }),
    ).toHaveAccessibleDescription(
      'Upgrade your organization to view billing metrics and usage.',
    );

    await user.click(screen.getByRole('button', { name: 'Upgrade plan' }));

    expect(mocks.useRouter().replace).toHaveBeenCalledWith(
      {
        pathname: '/orgs/[orgSlug]/billing',
        query: {
          orgSlug: 'xyz',
          tab: 'plan',
          source: 'settings',
          openUpgradeModal: true,
        },
      },
      undefined,
      { shallow: true, scroll: false },
    );
  });

  it('renders the real metrics surface for a paid organization admin', async () => {
    render(<BillingUsageTab isPaidOrg />);

    expect(
      await screen.findByRole('heading', { name: 'Billing metrics' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Upgrade plan' }),
    ).not.toBeInTheDocument();
  });
});
