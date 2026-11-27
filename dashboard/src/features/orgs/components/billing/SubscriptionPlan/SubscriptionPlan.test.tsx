import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { Organization_Status_Enum } from '@/generated/graphql';
import {
  mockMatchMediaValue,
  mockOrganization,
  mockRouter,
} from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import SubscriptionPlan from './SubscriptionPlan';

const mocks = vi.hoisted(() => ({ useRouter: vi.fn(), track: vi.fn() }));

vi.mock('next/router', () => ({ useRouter: mocks.useRouter }));
vi.mock('@/lib/segment', () => ({ analytics: { track: mocks.track } }));

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
  it('shows Cancelled in place of the plan and hides Upgrade', async () => {
    setOrganization(Organization_Status_Enum.Cancelled);

    render(<SubscriptionPlan />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This subscription is cancelled',
    );
    expect(
      screen.queryByText(mockOrganization.plan.name),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('month')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This subscription is cancelled',
    );
    expect(
      screen.getByRole('link', { name: /open a support ticket/ }),
    ).toHaveAttribute('href', 'https://app.nhost.io/support');
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

  it('tracks a dialog-only upgrade against the given organization', async () => {
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
    mocks.useRouter.mockReturnValue({
      ...mockRouter,
      pathname: '/support/ticket',
      route: '/support/ticket',
      asPath: '/support/ticket',
      query: {},
      isReady: true,
    });
    setOrganization(Organization_Status_Enum.Ok);
    server.use(
      nhostGraphQLLink.query('getOrganizationPlans', () =>
        HttpResponse.json({
          data: {
            plans: [
              mockOrganization.plan,
              { ...mockOrganization.plan, id: 'team', name: 'Team' },
            ],
          },
        }),
      ),
      nhostGraphQLLink.mutation('billingChangeOrganizationPlan', () =>
        HttpResponse.json({ data: { billingChangeOrganizationPlan: true } }),
      ),
    );
    const user = new TestUserEvent();

    render(
      <SubscriptionPlan
        dialogOnly={{ orgSlug: mockOrganization.slug, onClose: vi.fn() }}
      />,
    );
    await user.click(await screen.findByRole('radio', { name: /Team/ }));
    await user.click(screen.getByTestId('upgradeOrgSubmitButton'));

    await waitFor(() =>
      expect(mocks.track).toHaveBeenCalledWith(
        'Plan Changed',
        expect.objectContaining({ org_id: mockOrganization.id }),
      ),
    );
  });
});
