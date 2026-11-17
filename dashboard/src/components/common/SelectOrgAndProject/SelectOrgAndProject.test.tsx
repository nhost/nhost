import SelectOrgAndProject from '@/components/common/SelectOrgAndProject/SelectOrgAndProject';
import { render, screen, TestUserEvent } from '@/tests/testUtils';

const push = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({
  query: {} as Record<string, string | string[]>,
  pathname: '/orgs/_/projects/_/[...slug]',
  push,
}));

vi.mock('next/router', () => ({
  useRouter: () => router,
}));

vi.mock('@/features/orgs/projects/hooks/useOrgs', () => ({
  useOrgs: () => ({
    orgs: [
      {
        slug: 'org-a',
        name: 'Org A',
        apps: [{ name: 'Project A', subdomain: 'project-a' }],
      },
    ],
    loading: false,
  }),
}));

describe('SelectOrgAndProject', () => {
  beforeEach(() => {
    push.mockReset();
  });

  it('forwards the remaining path and query params to the selected project', async () => {
    router.query = {
      slug: ['database', 'settings'],
      tab: 'point-in-time',
    };
    const user = new TestUserEvent();
    render(<SelectOrgAndProject />);

    await user.click(screen.getByRole('button', { name: 'Select' }));

    expect(push).toHaveBeenCalledWith({
      pathname: '/orgs/org-a/projects/project-a/database/settings',
      query: { tab: 'point-in-time' },
    });
  });

  it('navigates to the project root when there is no slug', async () => {
    router.query = {};
    const user = new TestUserEvent();
    render(<SelectOrgAndProject />);

    await user.click(screen.getByRole('button', { name: 'Select' }));

    expect(push).toHaveBeenCalledWith({
      pathname: '/orgs/org-a/projects/project-a/',
      query: {},
    });
  });
});
