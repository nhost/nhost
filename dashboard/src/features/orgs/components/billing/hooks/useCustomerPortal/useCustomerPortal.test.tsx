import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import { vi } from 'vitest';
import { useCustomerPortal } from '@/features/orgs/components/billing/hooks/useCustomerPortal';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { mockMatchMediaValue, mockOrganization } from '@/tests/mocks';
import { getOrganization } from '@/tests/msw/mocks/graphql/getOrganizationQuery';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const server = setupServer();
const CUSTOMER_PORTAL_URL = 'https://billing.stripe.com/p/session/test';

function CustomerPortalTestHarness() {
  const { openCustomerPortal, loading } = useCustomerPortal();
  const { org, loading: organizationLoading } = useCurrentOrg();

  let organizationState = 'No organization';
  if (organizationLoading) {
    organizationState = 'Loading organization';
  } else if (org) {
    organizationState = org.id;
  }

  return (
    <>
      <span>{organizationState}</span>
      <span>{loading ? 'Portal loading' : 'Portal idle'}</span>
      <button type="button" onClick={openCustomerPortal}>
        Open customer portal
      </button>
    </>
  );
}

async function renderCustomerPortal() {
  const user = new TestUserEvent();
  render(<CustomerPortalTestHarness />);
  expect(await screen.findByText(mockOrganization.id)).toBeInTheDocument();
  return user;
}

beforeAll(() => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_ENV = 'production';
  server.listen();
});

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  mocks.useRouter.mockReturnValue({
    basePath: '',
    pathname: '/orgs/xyz/billing',
    route: '/orgs/[orgSlug]/billing',
    asPath: '/orgs/xyz/billing',
    isReady: true,
    isLocaleDomain: false,
    isPreview: false,
    isFallback: false,
    query: { orgSlug: 'xyz' },
    push: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    beforePopState: vi.fn(),
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
  });
  server.use(getOrganization);
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

describe('useCustomerPortal', () => {
  it('opens the customer portal with the organization ID and resets loading', async () => {
    let requestedOrganizationID: unknown;
    let resolvePortalLink!: (link: string) => void;
    const portalLink = new Promise<string>((resolve) => {
      resolvePortalLink = resolve;
    });
    server.use(
      nhostGraphQLLink.query(
        'billingOrganizationCustomePortal',
        async ({ variables }) => {
          requestedOrganizationID = variables.organizationID;
          const link = await portalLink;
          return HttpResponse.json({
            data: { billingOrganizationCustomePortal: link },
          });
        },
      ),
    );
    const openWindow = vi.spyOn(window, 'open').mockReturnValue(window);
    const user = await renderCustomerPortal();

    await user.click(
      screen.getByRole('button', { name: 'Open customer portal' }),
    );

    expect(await screen.findByText('Portal loading')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();

    resolvePortalLink(CUSTOMER_PORTAL_URL);

    expect(await screen.findByText('Portal idle')).toBeInTheDocument();
    expect(requestedOrganizationID).toBe(mockOrganization.id);
    expect(openWindow).toHaveBeenCalledWith(CUSTOMER_PORTAL_URL);
    expect(
      await screen.findByText('Redirecting to customer portal'),
    ).toBeInTheDocument();
  });

  it('shows an error and does not navigate when the portal link is null', async () => {
    server.use(
      nhostGraphQLLink.query('billingOrganizationCustomePortal', () =>
        HttpResponse.json({
          data: { billingOrganizationCustomePortal: null },
        }),
      ),
    );
    const openWindow = vi.spyOn(window, 'open').mockReturnValue(window);
    const initialHref = window.location.href;
    const user = await renderCustomerPortal();

    await user.click(
      screen.getByRole('button', { name: 'Open customer portal' }),
    );

    expect(
      await screen.findByText('Could not fetch customer portal link'),
    ).toBeInTheDocument();
    expect(openWindow).not.toHaveBeenCalled();
    expect(window.location.href).toBe(initialHref);
  });

  it('shows an error without requesting or opening the portal when the organization is missing', async () => {
    let organizationRequests = 0;
    let portalRequests = 0;
    server.use(
      nhostGraphQLLink.query('getOrganization', () => {
        organizationRequests += 1;
        return HttpResponse.json({ data: { organizations: [] } });
      }),
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
    render(<CustomerPortalTestHarness />);

    expect(await screen.findByText('No organization')).toBeInTheDocument();
    expect(organizationRequests).toBeGreaterThan(0);
    await user.click(
      screen.getByRole('button', { name: 'Open customer portal' }),
    );

    expect(
      await screen.findByText('Could not fetch customer portal link'),
    ).toBeInTheDocument();
    expect(portalRequests).toBe(0);
    expect(openWindow).not.toHaveBeenCalled();
    expect(window.location.href).toBe(initialHref);
  });

  it('shows a backend error without navigating', async () => {
    server.use(
      nhostGraphQLLink.query('billingOrganizationCustomePortal', () =>
        HttpResponse.json({
          errors: [{ message: 'Portal access denied' }],
        }),
      ),
    );
    const openWindow = vi.spyOn(window, 'open').mockReturnValue(window);
    const initialHref = window.location.href;
    const user = await renderCustomerPortal();

    await user.click(
      screen.getByRole('button', { name: 'Open customer portal' }),
    );

    expect(
      await screen.findByText('Could not fetch customer portal link'),
    ).toBeInTheDocument();
    expect(openWindow).not.toHaveBeenCalled();
    expect(window.location.href).toBe(initialHref);
  });

  it('falls back to same-window navigation when the portal popup is blocked', async () => {
    const fallbackURL = new URL('#customer-portal', window.location.href).href;
    server.use(
      nhostGraphQLLink.query('billingOrganizationCustomePortal', () =>
        HttpResponse.json({
          data: { billingOrganizationCustomePortal: fallbackURL },
        }),
      ),
    );
    const openWindow = vi.spyOn(window, 'open').mockReturnValue(null);
    const user = await renderCustomerPortal();

    await user.click(
      screen.getByRole('button', { name: 'Open customer portal' }),
    );

    await waitFor(() => {
      expect(window.location.hash).toBe('#customer-portal');
    });
    expect(openWindow).toHaveBeenCalledWith(fallbackURL);
    expect(window.location.href).toBe(fallbackURL);
  });
});
