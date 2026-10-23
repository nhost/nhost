import { setupServer } from 'msw/node';
import { mockOrganization } from '@/tests/mocks';
import { getProPlanOnlyQuery } from '@/tests/msw/mocks/graphql/plansQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen } from '@/tests/testUtils';
import BillingTabs from './BillingTabs';

const mocks = vi.hoisted(() => ({
  useCurrentOrg: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/orgs/[orgSlug]/billing',
    asPath: '/orgs/xyz/billing?tab=usage',
    query: { orgSlug: 'xyz', tab: 'usage' },
    isReady: true,
    replace: vi.fn(),
  }),
}));

vi.mock('@/features/orgs/projects/hooks/useCurrentOrg', () => ({
  useCurrentOrg: mocks.useCurrentOrg,
}));

const server = setupServer(tokenQuery, getProPlanOnlyQuery);

describe('BillingTabs', () => {
  beforeAll(() => {
    server.listen();
  });

  afterAll(() => {
    server.close();
  });

  it.each([
    { plan: 'free', isFree: true, selectedTab: 'Plan', paidOnlyDisabled: true },
    {
      plan: 'paid',
      isFree: false,
      selectedTab: 'Usage',
      paidOnlyDisabled: false,
    },
  ])(
    'opens a usage link on $selectedTab for a $plan organization',
    ({ isFree, selectedTab, paidOnlyDisabled }) => {
      mocks.useCurrentOrg.mockReturnValue({
        org: {
          ...mockOrganization,
          plan: { ...mockOrganization.plan, isFree },
        },
      });

      render(<BillingTabs />);

      expect(screen.getByRole('tab', { name: selectedTab })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByRole('tab', { name: 'Usage' })).toHaveProperty(
        'disabled',
        paidOnlyDisabled,
      );
      expect(screen.getByRole('button', { name: 'Invoices' })).toHaveProperty(
        'disabled',
        paidOnlyDisabled,
      );
    },
  );
});
