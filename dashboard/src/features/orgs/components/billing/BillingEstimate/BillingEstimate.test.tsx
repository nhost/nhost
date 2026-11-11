import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { Organization_Status_Enum } from '@/generated/graphql';
import { mockOrganization, mockRouter } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import { queryClient, render, screen } from '@/tests/testUtils';
import BillingEstimate from './BillingEstimate';

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
    nhostGraphQLLink.query('getOrganizationSpendingNotification', () =>
      HttpResponse.json({ data: { organizations: [{ threshold: 0 }] } }),
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

describe('BillingEstimate', () => {
  it('shows only the estimate for a cancelled subscription', async () => {
    setOrganization(Organization_Status_Enum.Cancelled);
    server.use(
      nhostGraphQLLink.query('billingGetNextInvoice', () =>
        HttpResponse.json({
          errors: [{ message: 'No upcoming invoices for customer' }],
        }),
      ),
    );

    render(<BillingEstimate />);

    expect(await screen.findByText('No upcoming invoice')).toBeInTheDocument();
    expect(
      screen.getByText(
        "This subscription is cancelled, so there's no next invoice to estimate.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/No upcoming invoices for customer/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Current billing cycle/)).not.toBeInTheDocument();
    expect(
      screen.queryByText('Spending Notifications'),
    ).not.toBeInTheDocument();
  });

  it('shows the billing cycle and spending notifications for an active subscription', async () => {
    setOrganization(Organization_Status_Enum.Ok);
    server.use(
      nhostGraphQLLink.query('billingGetNextInvoice', () =>
        HttpResponse.json({
          data: { billingGetNextInvoice: { AmountDue: 25, items: [] } },
        }),
      ),
    );

    render(<BillingEstimate />);

    expect(await screen.findByText('$25.00')).toBeInTheDocument();
    expect(screen.getByText(/Current billing cycle/)).toBeInTheDocument();
    expect(
      await screen.findByText('Spending Notifications'),
    ).toBeInTheDocument();
  });
});
