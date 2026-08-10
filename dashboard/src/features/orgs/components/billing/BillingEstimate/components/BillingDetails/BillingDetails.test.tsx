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

  it('shows an error alert when the next invoice query fails', async () => {
    server.use(
      getOrganization,
      nhostGraphQLLink.query('billingGetNextInvoice', () =>
        HttpResponse.json({ errors: [{ message: 'Failed to fetch invoice' }] }),
      ),
    );

    render(<BillingDetails />);

    expect(
      await screen.findByText('Failed to load billing details'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Failed to fetch invoice/)).toBeInTheDocument();
  });
});
