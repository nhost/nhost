import { render, screen, TestUserEvent } from '@/tests/testUtils';
import ProjectCardMenu from './ProjectCardMenu';

const copyMock = vi.fn();
vi.mock('@/utils/copy', () => ({
  copy: (...args: unknown[]) => copyMock(...args),
}));

const project = {
  id: 'p',
  name: 'shop',
  slug: 'shop',
  createdAt: '2026-11-01T00:00:00Z',
  subdomain: 'abcdefgh',
  repositoryProductionBranch: 'main',
  region: {
    id: 'eu',
    name: 'eu-central-1',
    countryCode: 'DE',
    city: 'Frankfurt',
  },
  githubRepository: null,
  deployments: [],
  pipelineRuns: [],
  creator: null,
  appStates: [],
};

describe('ProjectCardMenu', () => {
  beforeEach(() => copyMock.mockClear());

  it('copies the subdomain and the region', async () => {
    const user = new TestUserEvent();
    render(<ProjectCardMenu project={project} orgSlug="org" />);

    await user.click(
      screen.getByRole('button', { name: 'Actions for shop (eu-central-1)' }),
    );
    await user.click(
      await screen.findByRole('menuitem', { name: 'Copy subdomain' }),
    );
    expect(copyMock).toHaveBeenCalledWith('abcdefgh', 'Subdomain');

    await user.click(
      screen.getByRole('button', { name: 'Actions for shop (eu-central-1)' }),
    );
    await user.click(
      await screen.findByRole('menuitem', { name: 'Copy region' }),
    );
    expect(copyMock).toHaveBeenCalledWith('eu-central-1', 'Region');
  });

  it('links to the project settings', async () => {
    const user = new TestUserEvent();
    render(<ProjectCardMenu project={project} orgSlug="org" />);

    await user.click(
      screen.getByRole('button', { name: 'Actions for shop (eu-central-1)' }),
    );
    expect(
      await screen.findByRole('menuitem', { name: 'Settings' }),
    ).toHaveAttribute('href', '/orgs/org/projects/abcdefgh/settings');
  });

  it('hides Copy region when the project has no region code', async () => {
    const user = new TestUserEvent();
    render(
      <ProjectCardMenu
        project={{ ...project, region: { ...project.region, name: '' } }}
        orgSlug="org"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Actions for shop' }));
    await screen.findByRole('menuitem', { name: 'Copy subdomain' });
    expect(
      screen.queryByRole('menuitem', { name: 'Copy region' }),
    ).not.toBeInTheDocument();
  });
});
