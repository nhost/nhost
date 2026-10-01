import ProjectsComboBox from '@/components/layout/Header/ProjectsComboBox';
import {
  mockScrollIntoViewAndPointerCapture,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';

const push = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({
  query: { appSubdomain: 'project-a' } as Record<string, string>,
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
      apps: [
        { name: 'Project A', subdomain: 'project-a' },
        { name: 'Project B', subdomain: 'project-b' },
      ],
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
    mockScrollIntoViewAndPointerCapture();
    push.mockReset();
    router.query = { appSubdomain: 'project-a' };
    router.pathname = '/orgs/[orgSlug]/projects/[appSubdomain]';
  });

  it('keeps the tab when switching projects on the same page', async () => {
    router.query = { appSubdomain: 'project-a', tab: 'secrets' };
    router.pathname = '/orgs/[orgSlug]/projects/[appSubdomain]/settings';
    const user = new TestUserEvent();
    render(<ProjectsComboBox />);

    await user.click(screen.getByRole('combobox', { name: 'Switch project' }));
    await user.click(await screen.findByRole('option', { name: /project b/i }));

    expect(push).toHaveBeenCalledWith(
      '/orgs/org-a/projects/project-b/settings?tab=secrets',
    );
  });

  it('drops the tab when switching from a dynamic detail page', async () => {
    router.query = {
      appSubdomain: 'project-a',
      functionSlug: 'hello',
      tab: 'logs',
    };
    router.pathname =
      '/orgs/[orgSlug]/projects/[appSubdomain]/functions/[functionSlug]';
    const user = new TestUserEvent();
    render(<ProjectsComboBox />);

    await user.click(screen.getByRole('combobox', { name: 'Switch project' }));
    await user.click(await screen.findByRole('option', { name: /project b/i }));

    expect(push).toHaveBeenCalledWith(
      '/orgs/org-a/projects/project-b/functions',
    );
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
