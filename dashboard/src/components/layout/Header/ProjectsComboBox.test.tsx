import ProjectsComboBox from '@/components/layout/Header/ProjectsComboBox';
import { render, screen, TestUserEvent } from '@/tests/testUtils';

const push = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({
  query: { appSubdomain: 'project-a' },
  pathname: '/orgs/[orgSlug]/projects/[appSubdomain]',
  push,
}));

vi.mock('next/router', () => ({
  useRouter: () => router,
}));

vi.mock('@/components/layout/Header/HeaderCombobox', () => ({
  default: ({ footerSlot }: { footerSlot?: React.ReactNode }) => (
    <div>{footerSlot}</div>
  ),
}));

vi.mock('@/components/layout/Header/ProjectStatus', () => ({
  default: () => null,
}));

vi.mock('@/components/ui/v3/command', () => ({
  CommandItem: ({
    children,
    onSelect,
  }: {
    children: React.ReactNode;
    onSelect?: VoidFunction;
  }) => (
    <button type="button" onClick={onSelect}>
      {children}
    </button>
  ),
  CommandSeparator: () => <hr />,
}));

vi.mock('@/features/orgs/components/common/ProjectStatusIndicator', () => ({
  ProjectStatusIndicator: () => null,
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
  useProject: () => ({ project: { githubRepository: null } }),
}));

describe('ProjectsComboBox', () => {
  beforeEach(() => {
    push.mockReset();
  });

  it('pushes to the new project page from the footer', async () => {
    const user = new TestUserEvent();
    render(<ProjectsComboBox />);

    await user.click(screen.getByRole('button', { name: /new project/i }));

    expect(push).toHaveBeenCalledWith('/orgs/org-a/projects/new');
  });
});
