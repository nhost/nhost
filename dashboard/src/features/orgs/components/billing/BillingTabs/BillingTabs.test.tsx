import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { NextRouter } from 'next/router';
import { vi } from 'vitest';
import { BillingTabs } from '@/features/orgs/components/billing/BillingTabs';
import {
  CheckoutStatus,
  Organization_Members_Role_Enum,
} from '@/generated/graphql';
import {
  mockApplication,
  mockMatchMediaValue,
  mockOrganization,
  mockRouter,
  mockSession,
} from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  createGraphqlMockResolver,
  mockPointerEvent,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  router: {} as NextRouter,
}));

vi.mock('next/router', () => ({
  default: mocks.router,
  useRouter: () => mocks.router,
}));

const server = setupServer();

type RouterUrl = Parameters<NextRouter['push']>[0];

function updateRouter(url: RouterUrl) {
  if (typeof url === 'string') {
    return;
  }

  if (url.pathname) {
    mocks.router.pathname = url.pathname;
  }
  if (url.query && typeof url.query === 'object') {
    mocks.router.query = { ...url.query } as NextRouter['query'];
  }
}

function setRouter(query: NextRouter['query']) {
  Object.assign(mocks.router, {
    ...mockRouter,
    pathname: '/orgs/[orgSlug]/billing',
    route: '/orgs/[orgSlug]/billing',
    asPath: '/orgs/xyz/billing',
    isReady: true,
    query,
    push: vi.fn(async (url: RouterUrl) => {
      updateRouter(url);
      return true;
    }),
    replace: vi.fn(async (url: RouterUrl) => {
      updateRouter(url);
      return true;
    }),
  } satisfies NextRouter);
}

function createOrganization({
  isFree = false,
  isAdmin = true,
}: {
  isFree?: boolean;
  isAdmin?: boolean;
} = {}) {
  return {
    ...mockOrganization,
    plan: {
      ...mockOrganization.plan,
      id: isFree ? 'starter' : 'pro',
      name: isFree ? 'Starter' : 'Pro',
      isFree,
      price: isFree ? 0 : 25,
    },
    members: [
      {
        id: 'member-1',
        role: isAdmin
          ? Organization_Members_Role_Enum.Admin
          : Organization_Members_Role_Enum.User,
        user: {
          id: mockSession.user?.id,
          email: 'member@example.com',
          displayName: 'Member',
          avatarUrl: '',
          __typename: 'users' as const,
        },
        __typename: 'organization_members' as const,
      },
    ],
    apps: [mockApplication],
  };
}

function organizationHandler(
  options?: Parameters<typeof createOrganization>[0],
) {
  return nhostGraphQLLink.query('getOrganization', () =>
    HttpResponse.json({
      data: { organizations: [createOrganization(options)] },
    }),
  );
}

const plansHandler = nhostGraphQLLink.query('getOrganizationPlans', () =>
  HttpResponse.json({
    data: {
      plans: [
        {
          id: 'starter',
          name: 'Starter',
          isDefault: true,
          isFree: true,
          price: 0,
        },
        {
          id: 'pro',
          name: 'Pro',
          isDefault: false,
          isFree: false,
          price: 25,
        },
      ],
    },
  }),
);

const nextInvoiceHandler = nhostGraphQLLink.query('billingGetNextInvoice', () =>
  HttpResponse.json({
    data: {
      billingGetNextInvoice: {
        items: [],
        AmountDue: 25,
        PeriodEnd: '2026-09-01T00:00:00.000Z',
      },
    },
  }),
);

const spendingNotificationHandler = nhostGraphQLLink.query(
  'getOrganizationSpendingNotification',
  () =>
    HttpResponse.json({
      data: { organizations: [{ threshold: 0 }] },
    }),
);

beforeAll(() => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_ENV = 'production';
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation(mockMatchMediaValue),
  });
  server.listen();
});

beforeEach(() => {
  mockPointerEvent();
  setRouter({ orgSlug: 'xyz' });
  server.use(
    organizationHandler(),
    plansHandler,
    nextInvoiceHandler,
    spendingNotificationHandler,
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

describe('BillingTabs', () => {
  it('renders exact paid Plan composition by default without inactive panel actions', async () => {
    render(<BillingTabs />);

    const planTab = screen.getByRole('tab', { name: 'Plan' });
    const usageTab = screen.getByRole('tab', { name: 'Usage' });
    const invoicesTab = screen.getByRole('tab', { name: 'Invoices' });
    const panel = await screen.findByRole('tabpanel', { name: 'Plan' });

    expect(planTab).toHaveAttribute('aria-selected', 'true');
    expect(usageTab).toHaveAttribute('aria-selected', 'false');
    expect(invoicesTab).toHaveAttribute('aria-selected', 'false');
    expect(planTab).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveAttribute('aria-labelledby', planTab.id);
    expect(
      within(panel).getByRole('heading', { name: 'Subscription plan' }),
    ).toBeInTheDocument();
    expect(within(panel).getByText('Billing Estimate')).toBeInTheDocument();
    expect(
      within(panel).getAllByRole('button', { name: /upgrade/i }),
    ).toHaveLength(1);
    expect(
      screen.queryByRole('button', { name: 'Upgrade plan' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Billing metrics' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Open Stripe Customer Portal' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Invoices and billing' }),
    ).not.toBeInTheDocument();
  });

  it('falls back to Plan for invalid and array-valued tab queries without rewriting them', async () => {
    setRouter({ orgSlug: 'xyz', tab: 'not-a-tab', source: 'settings' });
    const { rerender } = render(<BillingTabs />);

    expect(
      await screen.findByRole('tabpanel', { name: 'Plan' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Plan',
      'Usage',
      'Invoices',
    ]);
    expect(mocks.router.replace).not.toHaveBeenCalled();

    mocks.router.query = {
      orgSlug: 'xyz',
      tab: ['usage'],
      source: 'settings',
    };
    rerender(<BillingTabs />);

    expect(screen.getByRole('tab', { name: 'Plan' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it('renders a direct Invoices tabpanel with Radix relationships for paid members', async () => {
    setRouter({ orgSlug: 'xyz', tab: 'invoices' });
    server.use(organizationHandler({ isAdmin: false }));
    render(<BillingTabs />);

    const invoicesTab = screen.getByRole('tab', { name: 'Invoices' });
    const invoicesPanel = await screen.findByRole('tabpanel', {
      name: 'Invoices',
    });

    expect(invoicesTab).toHaveAttribute('aria-selected', 'true');
    expect(invoicesTab).toHaveAttribute('aria-controls', invoicesPanel.id);
    expect(invoicesPanel).toHaveAttribute('aria-labelledby', invoicesTab.id);
    expect(
      within(invoicesPanel).getByRole('heading', {
        name: 'Invoices and billing',
      }),
    ).toBeInTheDocument();
    expect(
      within(invoicesPanel).getByRole('button', {
        name: 'Open Stripe Customer Portal',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Subscription plan' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Billing metrics' }),
    ).not.toBeInTheDocument();
  });

  it('keeps controlled URL state and unrelated queries synchronized for trigger and keyboard activation', async () => {
    setRouter({ orgSlug: 'xyz', source: 'settings' });
    const user = new TestUserEvent();
    const { rerender } = render(<BillingTabs />);
    await screen.findByRole('tabpanel', { name: 'Plan' });

    await user.click(screen.getByRole('tab', { name: 'Usage' }));

    expect(mocks.router.replace).toHaveBeenLastCalledWith(
      {
        pathname: '/orgs/[orgSlug]/billing',
        query: { orgSlug: 'xyz', source: 'settings', tab: 'usage' },
      },
      undefined,
      { shallow: true, scroll: false },
    );
    rerender(<BillingTabs />);

    const usageTab = screen.getByRole('tab', { name: 'Usage' });
    expect(usageTab).toHaveAttribute('aria-selected', 'true');
    expect(
      await screen.findByRole('tabpanel', { name: 'Usage' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('tabpanel', { name: 'Plan' }),
    ).not.toBeInTheDocument();

    usageTab.focus();
    await user.keyboard('{ArrowLeft}');
    rerender(<BillingTabs />);

    expect(mocks.router.replace).toHaveBeenLastCalledWith(
      {
        pathname: '/orgs/[orgSlug]/billing',
        query: { orgSlug: 'xyz', source: 'settings', tab: 'plan' },
      },
      undefined,
      { shallow: true, scroll: false },
    );
    expect(screen.getByRole('tab', { name: 'Plan' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      await screen.findByRole('tabpanel', { name: 'Plan' }),
    ).toBeInTheDocument();
  });

  it('renders paid Usage metrics only for organization admins', async () => {
    setRouter({ orgSlug: 'xyz', tab: 'usage' });
    render(<BillingTabs />);

    const usagePanel = await screen.findByRole('tabpanel', { name: 'Usage' });
    expect(
      within(usagePanel).getByRole('heading', { name: 'Billing metrics' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Subscription plan' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Billing Estimate')).not.toBeInTheDocument();
  });

  it('renders a stable permission state for paid non-admin Usage', async () => {
    setRouter({ orgSlug: 'xyz', tab: 'usage' });
    server.use(organizationHandler({ isAdmin: false }));
    render(<BillingTabs />);

    expect(
      await screen.findByRole('region', {
        name: 'Billing metrics are restricted',
      }),
    ).toHaveAccessibleDescription(
      'Organization administrator access is required to view billing metrics and usage.',
    );
  });

  it('renders the free Usage upgrade state and preserves its query parameters', async () => {
    setRouter({ orgSlug: 'xyz', tab: 'usage', source: 'email' });
    server.use(organizationHandler({ isFree: true }));
    const user = new TestUserEvent();
    render(<BillingTabs />);

    await user.click(
      await screen.findByRole('button', { name: 'Upgrade plan' }),
    );

    expect(mocks.router.replace).toHaveBeenLastCalledWith(
      {
        pathname: '/orgs/[orgSlug]/billing',
        query: {
          orgSlug: 'xyz',
          tab: 'plan',
          source: 'email',
          openUpgradeModal: true,
        },
      },
      undefined,
      { shallow: true, scroll: false },
    );
  });

  it('canonicalizes an upgrade modal to Plan before mounting content and then cleans the modal query', async () => {
    setRouter({
      orgSlug: 'xyz',
      tab: 'usage',
      openUpgradeModal: 'true',
      source: 'email',
    });
    mocks.router.replace = vi.fn().mockResolvedValue(true);
    const { rerender } = render(<BillingTabs />);

    expect(
      screen.getByRole('tablist', { name: 'Organization billing sections' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.router.replace).toHaveBeenCalledWith(
        {
          pathname: '/orgs/[orgSlug]/billing',
          query: {
            orgSlug: 'xyz',
            tab: 'plan',
            openUpgradeModal: 'true',
            source: 'email',
          },
        },
        undefined,
        { shallow: true, scroll: false },
      );
    });

    mocks.router.query = {
      orgSlug: 'xyz',
      tab: 'plan',
      openUpgradeModal: 'true',
      source: 'email',
    };
    rerender(<BillingTabs />);

    expect(
      await screen.findByRole('dialog', {
        name: 'Upgrade Organization Test organization',
      }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.router.query).toEqual({
        orgSlug: 'xyz',
        tab: 'plan',
        source: 'email',
      });
    });
    expect(mocks.router.push).toHaveBeenCalledWith(
      {
        pathname: '/orgs/[orgSlug]/billing',
        query: { orgSlug: 'xyz', tab: 'plan', source: 'email' },
      },
      undefined,
      { shallow: true },
    );
  });

  it('keeps Stripe-return processing mounted on Usage', async () => {
    setRouter({ orgSlug: 'xyz', tab: 'usage', session_id: 'checkout-session' });
    const finishUpgrade = createGraphqlMockResolver(
      'postOrganizationRequest',
      'mutation',
    );
    server.use(finishUpgrade.handler);
    render(<BillingTabs />);

    expect(
      await screen.findByRole('dialog', {
        name: 'Upgrade Organization Test organization',
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('message')).toHaveTextContent(
      'Upgrading organization',
    );

    finishUpgrade.resolve({
      billingPostOrganizationRequest: {
        Status: CheckoutStatus.Open,
        Slug: 'xyz',
        ClientSecret: null,
      },
    });
  });

  it('finishes a default Plan Stripe return and reveals the paid estimate', async () => {
    setRouter({ orgSlug: 'xyz', session_id: 'checkout-session' });
    let upgraded = false;
    server.use(
      nhostGraphQLLink.query('getOrganization', () =>
        HttpResponse.json({
          data: {
            organizations: [createOrganization({ isFree: !upgraded })],
          },
        }),
      ),
      nhostGraphQLLink.mutation('postOrganizationRequest', () => {
        upgraded = true;
        return HttpResponse.json({
          data: {
            billingPostOrganizationRequest: {
              Status: CheckoutStatus.Completed,
              Slug: 'xyz',
              ClientSecret: null,
            },
          },
        });
      }),
    );

    render(<BillingTabs />);

    expect(
      await screen.findByRole('heading', { name: 'Subscription plan' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Spending Notifications'),
    ).toBeInTheDocument();
    expect(screen.getByText('Billing Estimate')).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.router.query).toEqual({ orgSlug: 'xyz' });
    });
  });
});
