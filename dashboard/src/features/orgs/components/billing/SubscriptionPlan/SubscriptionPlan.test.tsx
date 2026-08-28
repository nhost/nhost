import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import { vi } from 'vitest';
import { SubscriptionPlan } from '@/features/orgs/components/billing/SubscriptionPlan';
import { mockMatchMediaValue } from '@/tests/mocks';
import { getOrganization } from '@/tests/msw/mocks/graphql/getOrganizationQuery';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  createGraphqlMockResolver,
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

const getOrganizationPlans = nhostGraphQLLink.query(
  'getOrganizationPlans',
  () =>
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
            id: 'abc',
            name: 'Pro',
            isDefault: false,
            isFree: false,
            price: 25,
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
  server.use(getOrganization, getOrganizationPlans);
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

describe('SubscriptionPlan', () => {
  it('opens the existing upgrade dialog from the exact Upgrade action', async () => {
    const user = new TestUserEvent();
    render(<SubscriptionPlan />);

    const upgradeButton = await screen.findByRole('button', {
      name: 'Upgrade',
    });
    await user.click(upgradeButton);

    expect(
      await screen.findByRole('dialog', {
        name: 'Upgrade Organization Test organization',
      }),
    ).toBeInTheDocument();
  });

  it('keeps the Upgrade action disabled while the portal link is loading', async () => {
    const portal = createGraphqlMockResolver(
      'billingOrganizationCustomePortal',
      'query',
    );
    server.use(portal.handler);
    const openWindow = vi.spyOn(window, 'open').mockReturnValue(window);
    const user = new TestUserEvent();
    render(<SubscriptionPlan />);

    const portalButton = await screen.findByRole('button', {
      name: 'Stripe Customer Portal',
    });
    const upgradeButton = screen.getByRole('button', {
      name: 'Upgrade',
    });
    await user.click(portalButton);

    await waitFor(() => {
      expect(portalButton).toBeDisabled();
      expect(upgradeButton).toBeDisabled();
    });

    portal.resolve({
      billingOrganizationCustomePortal:
        'https://billing.stripe.com/p/session/test',
    });

    await waitFor(() => {
      expect(portalButton).toBeEnabled();
      expect(upgradeButton).toBeEnabled();
    });
    expect(openWindow).toHaveBeenCalledWith(
      'https://billing.stripe.com/p/session/test',
    );
  });
});
