import { setupServer } from 'msw/node';
import { useRouter } from 'next/router';
import { mockOrganization, mockRouter } from '@/tests/mocks';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen } from '@/tests/testUtils';
import BillingArea from './BillingArea';

const mocks = vi.hoisted(() => ({
  useCurrentOrg: vi.fn(),
}));

vi.mock('next/router', () => ({ useRouter: vi.fn() }));

vi.mock('@/components/common/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));

vi.mock('@/features/orgs/projects/hooks/useCurrentOrg', () => ({
  useCurrentOrg: mocks.useCurrentOrg,
}));

const server = setupServer(tokenQuery);

function renderUsagePage(isFree: boolean) {
  vi.mocked(useRouter).mockReturnValue({
    ...mockRouter,
    route: '/orgs/[orgSlug]/billing/usage',
    pathname: '/orgs/[orgSlug]/billing/usage',
    asPath: '/orgs/xyz/billing/usage',
    query: { orgSlug: 'xyz' },
  });
  mocks.useCurrentOrg.mockReturnValue({
    org: { ...mockOrganization, plan: { ...mockOrganization.plan, isFree } },
  });

  render(
    <BillingArea>
      <h1>Usage content</h1>
    </BillingArea>,
  );
}

describe('BillingArea', () => {
  beforeAll(() => {
    server.listen();
  });

  afterAll(() => {
    server.close();
  });

  it('links to usage and opens invoices for a paid organization', () => {
    renderUsagePage(false);

    expect(screen.getByRole('link', { name: 'Plan' })).toHaveAttribute(
      'href',
      '/orgs/xyz/billing',
    );
    const usage = screen.getByRole('link', { name: 'Usage' });
    expect(usage).toHaveAttribute('href', '/orgs/xyz/billing/usage');
    expect(usage).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Invoices' })).toBeEnabled();
    expect(
      screen.getByRole('heading', { name: 'Usage content' }),
    ).toBeInTheDocument();
  });

  it('shows only the plan tab for a free organization', () => {
    renderUsagePage(true);

    expect(screen.getByRole('link', { name: 'Plan' })).toHaveAttribute(
      'href',
      '/orgs/xyz/billing',
    );
    expect(screen.queryByText('Usage')).not.toBeInTheDocument();
    expect(screen.queryByText('Invoices')).not.toBeInTheDocument();
  });
});
