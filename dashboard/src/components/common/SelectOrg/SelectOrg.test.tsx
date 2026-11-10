import SelectOrg from '@/components/common/SelectOrg/SelectOrg';
import { render, screen, TestUserEvent } from '@/tests/testUtils';

const push = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({
  query: {} as Record<string, string | string[]>,
  pathname: '/orgs/_/[...slug]',
  push,
}));

vi.mock('next/router', () => ({
  useRouter: () => router,
}));

vi.mock('@/features/orgs/projects/hooks/useOrgs', () => ({
  useOrgs: () => ({
    orgs: [{ slug: 'org-a', name: 'Org A', apps: [] }],
    loading: false,
  }),
}));

describe('SelectOrg', () => {
  beforeEach(() => {
    push.mockReset();
  });

  it('forwards the remaining path and query params to the selected organization', async () => {
    router.query = { slug: ['billing'], tab: 'invoices' };
    const user = new TestUserEvent();
    render(<SelectOrg />);

    await user.click(screen.getByRole('button', { name: 'Select' }));

    expect(push).toHaveBeenCalledWith({
      pathname: '/orgs/org-a/billing',
      query: { tab: 'invoices' },
    });
  });

  it('navigates to the organization root when there is no slug', async () => {
    router.query = {};
    const user = new TestUserEvent();
    render(<SelectOrg />);

    await user.click(screen.getByRole('button', { name: 'Select' }));

    expect(push).toHaveBeenCalledWith({
      pathname: '/orgs/org-a/',
      query: {},
    });
  });
});
