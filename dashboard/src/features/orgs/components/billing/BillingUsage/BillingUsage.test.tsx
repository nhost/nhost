import { delay, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { mockApplication, mockOrganization } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen, TestUserEvent, within } from '@/tests/testUtils';
import BillingUsage from './BillingUsage';

const mocks = vi.hoisted(() => ({
  useCurrentOrg: vi.fn(),
  useIsOrgAdmin: vi.fn(),
}));

vi.mock('@/features/orgs/hooks/useIsOrgAdmin', () => ({
  useIsOrgAdmin: mocks.useIsOrgAdmin,
}));

vi.mock('@/features/orgs/projects/hooks/useCurrentOrg', () => ({
  useCurrentOrg: mocks.useCurrentOrg,
}));

const billingMetrics = {
  billingReports: [
    {
      __typename: 'billing_reports',
      appID: mockApplication.id,
      type: 'egress',
      value: 2048,
      reportEnds: new Date().toISOString(),
    },
  ],
  billingResources: [
    {
      __typename: 'billing_resources',
      appID: mockApplication.id,
      functionsAmount: 2,
      customDomains: 0,
      persistentVolume: 0,
      pitr: 0,
    },
  ],
  billingTimeBasedUsages: [],
};

const getBillingMetrics = nhostGraphQLLink.query('getBillingMetrics', () =>
  HttpResponse.json({ data: billingMetrics }),
);

function nextInvoiceEndingAt(periodEnd: string) {
  return nhostGraphQLLink.query('billingGetNextInvoice', () =>
    HttpResponse.json({
      data: {
        billingGetNextInvoice: {
          __typename: 'InvoiceSummary',
          AmountDue: 0,
          PeriodEnd: periodEnd,
          items: [],
        },
      },
    }),
  );
}

const now = new Date();
const getNextInvoice = nextInvoiceEndingAt(
  new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  ).toISOString(),
);

const server = setupServer(tokenQuery, getBillingMetrics, getNextInvoice);

describe('BillingUsage', () => {
  beforeAll(() => {
    server.listen();
  });

  beforeEach(() => {
    mocks.useCurrentOrg.mockReturnValue({ org: mockOrganization });
    mocks.useIsOrgAdmin.mockReturnValue(true);
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it('tells members who are not org admins that usage metrics are restricted', () => {
    mocks.useIsOrgAdmin.mockReturnValue(false);

    render(<BillingUsage />);

    expect(
      screen.getByRole('heading', { name: 'Usage metrics are restricted' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
  });

  it('loads the usage metrics again when retrying after an error', async () => {
    server.use(
      nhostGraphQLLink.query(
        'getBillingMetrics',
        () => HttpResponse.json({ errors: [{ message: 'Internal error' }] }),
        { once: true },
      ),
    );
    const user = new TestUserEvent();

    render(<BillingUsage />);

    expect(
      await screen.findByRole('heading', {
        name: 'Usage metrics are unavailable',
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('heading', { name: 'Usage by project' }),
    ).toBeInTheDocument();
  });

  it('keeps showing the usage metrics while they refresh', async () => {
    const user = new TestUserEvent();

    render(<BillingUsage />);

    await screen.findByRole('heading', { name: 'Usage by project' });

    server.use(
      nhostGraphQLLink.query('getBillingMetrics', async () => {
        await delay('infinite');
        return HttpResponse.json({ data: billingMetrics });
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(
      screen.getByRole('heading', { name: 'Usage by project' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Loading usage metrics...'),
    ).not.toBeInTheDocument();
  });

  it("shows a project's dedicated compute in the tracked resources", async () => {
    server.use(
      nhostGraphQLLink.query('getBillingMetrics', () =>
        HttpResponse.json({
          data: {
            ...billingMetrics,
            billingTimeBasedUsages: [
              {
                __typename: 'billing_time_based_usage',
                appID: mockApplication.id,
                value: 2000,
              },
            ],
          },
        }),
      ),
    );

    render(<BillingUsage />);

    const table = await screen.findByRole('table');
    expect(within(table).getByText('2,000 millicores')).toBeInTheDocument();
  });

  it('labels a deleted project by its shortened ID', async () => {
    server.use(
      nhostGraphQLLink.query('getBillingMetrics', () =>
        HttpResponse.json({
          data: {
            ...billingMetrics,
            billingResources: [
              {
                ...billingMetrics.billingResources[0],
                appID: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
              },
            ],
          },
        }),
      ),
    );

    render(<BillingUsage />);

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Deleted project')).toBeInTheDocument();
    expect(within(table).getByText('f81d4fae…6bf6')).toBeInTheDocument();
  });

  describe('on Nov 5, 2026', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-05T10:00:00.000Z'));
      server.use(
        nhostGraphQLLink.query('getBillingMetrics', () =>
          HttpResponse.json({
            data: {
              ...billingMetrics,
              billingReports: [
                {
                  ...billingMetrics.billingReports[0],
                  reportEnds: '2026-11-05T08:00:00.000Z',
                },
              ],
            },
          }),
        ),
      );
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('names a cycle that ends on the 30th after the next invoice', async () => {
      server.use(nextInvoiceEndingAt('2026-11-30T23:00:00Z'));

      render(<BillingUsage />);

      expect(
        await screen.findByRole('button', {
          name: 'Current billing cycle · Oct 30 – Nov 30',
        }),
      ).toBeInTheDocument();
    });

    it('names the UTC month when the next invoice is unavailable', async () => {
      server.use(
        nhostGraphQLLink.query('billingGetNextInvoice', () =>
          HttpResponse.json({ errors: [{ message: 'Stripe is down' }] }),
        ),
      );

      render(<BillingUsage />);

      expect(
        await screen.findByRole('button', {
          name: 'Current billing cycle · Nov 2026',
        }),
      ).toBeInTheDocument();
    });
  });
});
