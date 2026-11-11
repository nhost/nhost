import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { Organization_Status_Enum } from '@/generated/graphql';
import { mockOrganization, mockRouter } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import { queryClient, render, screen } from '@/tests/testUtils';
import SubscriptionPlan from './SubscriptionPlan';

const mocks = vi.hoisted(() => ({ useRouter: vi.fn() }));

vi.mock('next/router', () => ({ useRouter: mocks.useRouter }));

const server = setupServer();

function setOrganization(status: Organization_Status_Enum) {
  server.use(
    nhostGraphQLLink.query('getOrganization', () =>
      HttpResponse.json({
        data: { organizations: [{ ...mockOrganization, status }] },
      }),
    ),
  );
}

beforeAll(() => server.listen());

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
  mocks.useRouter.mockReturnValue({
    ...mockRouter,
    pathname: '/orgs/[orgSlug]/billing',
    route: '/orgs/[orgSlug]/billing',
    asPath: `/orgs/${mockOrganization.slug}/billing`,
    query: { orgSlug: mockOrganization.slug },
    isReady: true,
  });
  server.use(
    nhostGraphQLLink.query('getOrganizationPlans', () =>
      HttpResponse.json({ data: { plans: [] } }),
    ),
  );
});

afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

afterAll(() => server.close());

describe('SubscriptionPlan', () => {
  it('marks a cancelled plan and hides Upgrade', async () => {
    setOrganization(Organization_Status_Enum.Cancelled);

    render(<SubscriptionPlan />);

    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Upgrade' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Stripe Customer Portal' }),
    ).toBeInTheDocument();
  });

  it('offers Upgrade for an active plan', async () => {
    setOrganization(Organization_Status_Enum.Ok);

    render(<SubscriptionPlan />);

    expect(
      await screen.findByRole('button', { name: 'Upgrade' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Cancelled')).not.toBeInTheDocument();
  });
});
