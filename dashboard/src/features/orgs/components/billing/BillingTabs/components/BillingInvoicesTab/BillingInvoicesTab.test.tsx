import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { NextRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { vi } from 'vitest';
import { BillingInvoicesTab } from '@/features/orgs/components/billing/BillingTabs/components/BillingInvoicesTab';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { Organization_Members_Role_Enum } from '@/generated/graphql';
import {
  mockMatchMediaValue,
  mockOrganization,
  mockRouter,
  mockSession,
} from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  router: {} as NextRouter,
}));

vi.mock('next/router', () => ({
  default: mocks.router,
  useRouter: () => mocks.router,
}));

const server = setupServer();
const CUSTOMER_PORTAL_URL = 'https://billing.stripe.com/p/session/test';

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
    asPath: '/orgs/xyz/billing?tab=invoices',
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

function createOrganization(role: Organization_Members_Role_Enum) {
  return {
    ...mockOrganization,
    members: [
      {
        id: 'member-1',
        role,
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
  };
}

function organizationHandler(role = Organization_Members_Role_Enum.Admin) {
  return nhostGraphQLLink.query('getOrganization', () =>
    HttpResponse.json({
      data: { organizations: [createOrganization(role)] },
    }),
  );
}

function BillingInvoicesTabHarness({ isPaidOrg }: { isPaidOrg: boolean }) {
  const { org, loading } = useCurrentOrg();

  let organizationState = 'No organization';
  if (loading) {
    organizationState = 'Loading organization';
  } else if (org) {
    organizationState = org.id;
  }

  return (
    <>
      <span>{organizationState}</span>
      <BillingInvoicesTab isPaidOrg={isPaidOrg} />
    </>
  );
}

async function renderPaidInvoices() {
  const user = new TestUserEvent();
  render(<BillingInvoicesTabHarness isPaidOrg />);
  expect(await screen.findByText(mockOrganization.id)).toBeInTheDocument();
  return user;
}

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
  window.history.replaceState({}, '', '/');
  setRouter({ orgSlug: 'xyz', tab: 'invoices' });
  server.use(organizationHandler());
});

afterEach(() => {
  toast.remove();
  server.resetHandlers();
  queryClient.clear();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
});

describe('BillingInvoicesTab', () => {
  it('shows truthful portal guidance for free organizations and preserves unrelated query values when upgrading', async () => {
    setRouter({ orgSlug: 'xyz', tab: 'invoices', source: 'email' });
    const user = new TestUserEvent();
    render(<BillingInvoicesTab isPaidOrg={false} />);

    expect(
      screen.getByRole('region', {
        name: 'Invoices are available on paid plans',
      }),
    ).toHaveAccessibleDescription(
      'Upgrade your organization to access invoices and billing details in the Stripe Customer Portal.',
    );
    expect(
      screen.queryByRole('button', { name: 'Open Stripe Customer Portal' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Upgrade plan' }));

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

  it.each([
    ['administrator', Organization_Members_Role_Enum.Admin],
    ['member', Organization_Members_Role_Enum.User],
  ])('opens the customer portal for a paid organization %s', async (_, role) => {
    server.use(
      organizationHandler(role),
      nhostGraphQLLink.query('billingOrganizationCustomePortal', () =>
        HttpResponse.json({
          data: { billingOrganizationCustomePortal: CUSTOMER_PORTAL_URL },
        }),
      ),
    );
    const openWindow = vi.spyOn(window, 'open').mockReturnValue(window);
    const user = await renderPaidInvoices();

    const region = screen.getByRole('region', { name: 'Invoices and billing' });
    expect(region).toHaveAccessibleDescription(
      'View invoices and manage billing details in the Stripe Customer Portal.',
    );
    await user.click(
      screen.getByRole('button', { name: 'Open Stripe Customer Portal' }),
    );

    await waitFor(() => {
      expect(openWindow).toHaveBeenCalledWith(CUSTOMER_PORTAL_URL);
    });
  });

  it('keeps the portal action accessible by name while loading', async () => {
    let resolvePortalLink!: (link: string) => void;
    const portalLink = new Promise<string>((resolve) => {
      resolvePortalLink = resolve;
    });
    server.use(
      nhostGraphQLLink.query('billingOrganizationCustomePortal', async () =>
        HttpResponse.json({
          data: { billingOrganizationCustomePortal: await portalLink },
        }),
      ),
    );
    vi.spyOn(window, 'open').mockReturnValue(window);
    const user = await renderPaidInvoices();
    const portalButton = screen.getByRole('button', {
      name: 'Open Stripe Customer Portal',
    });

    await user.click(portalButton);

    await waitFor(() => {
      expect(portalButton).toBeDisabled();
      expect(portalButton).toHaveAccessibleName('Open Stripe Customer Portal');
    });

    resolvePortalLink(CUSTOMER_PORTAL_URL);

    await waitFor(() => {
      expect(portalButton).toBeEnabled();
    });
  });

  it('renders the external-link icon as a decorative, correctly sized element', () => {
    render(<BillingInvoicesTab isPaidOrg />);

    const portalButton = screen.getByRole('button', {
      name: 'Open Stripe Customer Portal',
    });
    const externalLinkIcon = portalButton.querySelector(
      'svg.lucide-external-link',
    );

    expect(externalLinkIcon).toHaveClass('h-4', 'w-4');
    expect(externalLinkIcon).toHaveAttribute('aria-hidden', 'true');
    expect(externalLinkIcon).toHaveAttribute('focusable', 'false');
  });

  it('shows backend denial without navigating', async () => {
    server.use(
      organizationHandler(Organization_Members_Role_Enum.User),
      nhostGraphQLLink.query('billingOrganizationCustomePortal', () =>
        HttpResponse.json({
          errors: [{ message: 'Portal access denied' }],
        }),
      ),
    );
    const openWindow = vi.spyOn(window, 'open').mockReturnValue(window);
    const initialHref = window.location.href;
    const user = await renderPaidInvoices();

    await user.click(
      screen.getByRole('button', { name: 'Open Stripe Customer Portal' }),
    );

    expect(
      await screen.findByText('Could not fetch customer portal link'),
    ).toBeInTheDocument();
    expect(openWindow).not.toHaveBeenCalled();
    expect(window.location.href).toBe(initialHref);
  });

  it('shows a safe error without requesting or opening the portal when the organization is missing', async () => {
    let portalRequests = 0;
    server.use(
      nhostGraphQLLink.query('getOrganization', () =>
        HttpResponse.json({ data: { organizations: [] } }),
      ),
      nhostGraphQLLink.query('billingOrganizationCustomePortal', () => {
        portalRequests += 1;
        return HttpResponse.json({
          data: { billingOrganizationCustomePortal: CUSTOMER_PORTAL_URL },
        });
      }),
    );
    const openWindow = vi.spyOn(window, 'open').mockReturnValue(window);
    const initialHref = window.location.href;
    const user = new TestUserEvent();
    render(<BillingInvoicesTabHarness isPaidOrg />);

    expect(await screen.findByText('No organization')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Open Stripe Customer Portal' }),
    );

    expect(
      await screen.findByText('Could not fetch customer portal link'),
    ).toBeInTheDocument();
    expect(portalRequests).toBe(0);
    expect(openWindow).not.toHaveBeenCalled();
    expect(window.location.href).toBe(initialHref);
  });
});
