import ProjectsComboBox from '@/components/layout/Header/ProjectsComboBox';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';

const push = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({
  query: { appSubdomain: 'project-a' },
  pathname: '/orgs/[orgSlug]/projects/[appSubdomain]',
  push,
}));

vi.mock('next/router', () => ({
  useRouter: () => router,
}));

vi.mock('@/features/orgs/projects/common/hooks/useAppState', () => ({
  useAppState: () => ({ state: 1 }),
}));

vi.mock('@/features/orgs/projects/hooks/useOrgs', () => ({
  useOrgs: () => ({
    currentOrg: {
      slug: 'org-a',
      apps: [{ name: 'Project A', subdomain: 'project-a' }],
    },
  }),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({
    project: { githubRepository: null, appStates: [] },
  }),
}));

describe('ProjectsComboBox', () => {
  beforeEach(() => {
    mockPointerEvent();
    push.mockReset();
  });

  it('pushes to the new project page from the footer', async () => {
    const user = new TestUserEvent();
    render(<ProjectsComboBox />);

    await user.click(screen.getByRole('combobox', { name: 'Switch project' }));
    await user.click(
      await screen.findByRole('option', { name: /new project/i }),
    );

    expect(push).toHaveBeenCalledWith('/orgs/org-a/projects/new');
  });
});
