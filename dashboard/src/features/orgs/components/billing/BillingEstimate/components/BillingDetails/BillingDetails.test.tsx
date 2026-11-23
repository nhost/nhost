import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
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
import BillingDetails from './BillingDetails';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

const server = setupServer();

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
});

afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
});

describe('BillingDetails', () => {
  it('shows a loading indicator while the next invoice is being fetched', async () => {
    const invoice = createGraphqlMockResolver('billingGetNextInvoice', 'query');
    server.use(getOrganization, invoice.handler);

    render(<BillingDetails />);

    expect(
      await screen.findByText('Loading billing details...'),
    ).toBeInTheDocument();
  });

  it('shows a friendly error without the backend message when the next invoice query fails', async () => {
    server.use(
      getOrganization,
      nhostGraphQLLink.query('billingGetNextInvoice', () =>
        HttpResponse.json({ errors: [{ message: 'Failed to fetch invoice' }] }),
      ),
    );

    render(<BillingDetails />);

    expect(
      await screen.findByText("Couldn't load billing details"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Failed to fetch invoice/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /open a support ticket/ }),
    ).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('retries the next invoice query when Try again is clicked', async () => {
    let calls = 0;
    server.use(
      getOrganization,
      nhostGraphQLLink.query('billingGetNextInvoice', () => {
        calls += 1;
        return HttpResponse.json({
          errors: [{ message: 'Failed to fetch invoice' }],
        });
      }),
    );

    render(<BillingDetails />);
    const user = new TestUserEvent();

    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(calls).toBeGreaterThan(1));
    expect(
      await screen.findByText("Couldn't load billing details"),
    ).toBeInTheDocument();
  });

  it('says no details are available when there is no upcoming invoice', async () => {
    server.use(
      getOrganization,
      nhostGraphQLLink.query('billingGetNextInvoice', () =>
        HttpResponse.json({ data: { billingGetNextInvoice: null } }),
      ),
    );

    render(<BillingDetails />);

    expect(
      await screen.findByText('No upcoming invoice details are available.'),
    ).toBeInTheDocument();
  });
});
