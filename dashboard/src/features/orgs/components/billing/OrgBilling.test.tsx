import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { NextRouter } from 'next/router';
import { vi } from 'vitest';
import OrgBilling from '@/pages/orgs/[orgSlug]/billing';
import {
  mockMatchMediaValue,
  mockOrganization,
  mockRouter,
} from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import { queryClient, render, screen } from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  router: {} as NextRouter,
  useCurrentOrg: vi.fn(),
}));

vi.mock('next/router', () => ({
  default: mocks.router,
  useRouter: () => mocks.router,
}));

vi.mock('@/features/orgs/projects/hooks/useCurrentOrg', () => ({
  useCurrentOrg: mocks.useCurrentOrg,
}));

const server = setupServer(
  nhostGraphQLLink.query('getOrganizationPlans', () =>
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
        ],
      },
    }),
  ),
);

const freeOrganization = {
  ...mockOrganization,
  plan: {
    ...mockOrganization.plan,
    id: 'starter',
    name: 'Starter',
    isFree: true,
    price: 0,
  },
};

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
  Object.assign(mocks.router, {
    ...mockRouter,
    pathname: '/orgs/[orgSlug]/billing',
    route: '/orgs/[orgSlug]/billing',
    asPath: '/orgs/xyz/billing',
    isReady: true,
    query: { orgSlug: 'xyz' },
    push: vi.fn(),
    replace: vi.fn(),
  } satisfies NextRouter);
  mocks.useCurrentOrg.mockReturnValue({
    org: freeOrganization,
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
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

describe('OrgBilling', () => {
  it('does not flash Plan content before the router is ready', async () => {
    mocks.router.isReady = false;
    const { container, rerender } = render(<OrgBilling />);

    expect(container.querySelector('div.absolute')).toHaveClass(
      'top-0',
      'right-0',
      'bottom-0',
      'left-0',
      'h-full',
      'w-full',
    );
    expect(screen.queryByRole('tab', { name: 'Plan' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Subscription plan' }),
    ).not.toBeInTheDocument();

    mocks.router.isReady = true;
    rerender(<OrgBilling />);

    expect(
      await screen.findByRole('heading', { name: 'Subscription plan' }),
    ).toBeInTheDocument();
  });

  it('keeps the loading guard while organization data is loading', () => {
    mocks.useCurrentOrg.mockReturnValue({
      org: undefined,
      loading: true,
      error: null,
      refetch: vi.fn(),
    });

    const { container } = render(<OrgBilling />);

    expect(container.querySelector('div.absolute')).toHaveClass(
      'top-0',
      'right-0',
      'bottom-0',
      'left-0',
    );
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('preserves the existing paid expression when organization data is absent after readiness', async () => {
    mocks.useCurrentOrg.mockReturnValue({
      org: undefined,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<OrgBilling />);

    expect(await screen.findByText('Billing Estimate')).toBeInTheDocument();
  });

  it('preserves the page layout classes and getLayout contract', async () => {
    const { container } = render(<OrgBilling />);

    await screen.findByRole('tablist', {
      name: 'Organization billing sections',
    });
    expect(container.querySelector('div.flex.h-full')).toHaveClass(
      'flex',
      'h-full',
      'flex-col',
      'gap-4',
      'overflow-auto',
      'bg-accent-background',
      'p-4',
    );
    expect(OrgBilling.getLayout).toBeTypeOf('function');
  });
});
