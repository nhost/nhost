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
  billingDedicatedComputes: [],
};

const getBillingMetrics = nhostGraphQLLink.query('getBillingMetrics', () =>
  HttpResponse.json({ data: billingMetrics }),
);

const server = setupServer(tokenQuery, getBillingMetrics);

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
    await user.click(screen.getByRole('button', { name: 'Refresh metrics' }));

    expect(
      screen.getByRole('heading', { name: 'Usage by project' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Loading usage metrics...'),
    ).not.toBeInTheDocument();
  });

  it.each([
    { planName: 'Pro', pricingIcons: 1 },
    { planName: 'Enterprise', pricingIcons: 0 },
  ])(
    'shows Pro/Team pricing icons only outside Enterprise ($planName plan)',
    async ({ planName, pricingIcons }) => {
      mocks.useCurrentOrg.mockReturnValue({
        org: {
          ...mockOrganization,
          plan: { ...mockOrganization.plan, name: planName },
        },
      });

      render(<BillingUsage />);

      const computeColumn = await screen.findByRole('columnheader', {
        name: 'Compute',
      });
      expect(computeColumn.querySelectorAll('svg')).toHaveLength(pricingIcons);
    },
  );

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
});
