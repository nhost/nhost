import type { Project } from '@/features/orgs/components/projects/ProjectsGrid';
import { PipelineRunStatus_Enum } from '@/generated/graphql';
import { render, screen, TestUserEvent, within } from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';
import ProjectsTable from './ProjectsTable';

vi.mock('@/features/orgs/projects/hooks/useCurrentOrg', () => ({
  useCurrentOrg: () => ({ org: { slug: 'test-org' } }),
}));

const US_REGION: Project['region'] = {
  id: 'us',
  name: 'us-east-1',
  countryCode: 'US',
  city: 'Virginia',
};

function makeProject(
  subdomain: string,
  overrides: Partial<Project> = {},
): Project {
  return {
    id: subdomain,
    name: 'shop',
    slug: subdomain,
    createdAt: '2026-11-01T00:00:00Z',
    subdomain,
    repositoryProductionBranch: 'main',
    region: US_REGION,
    githubRepository: null,
    deployments: [],
    pipelineRuns: [],
    creator: null,
    appStates: [],
    ...overrides,
  };
}

function failedRun(): Project['pipelineRuns'][number] {
  return {
    id: 'run',
    name: 'deploy',
    startedAt: '2026-11-01T00:00:00Z',
    endedAt: '2026-11-01T00:05:00Z',
    status: PipelineRunStatus_Enum.Failed,
    input: { commit_user_name: 'Ada' },
    appId: 'x',
    createdAt: '2026-11-01T00:00:00Z',
  };
}

function rowOf(linkName: string) {
  const row = screen.getByRole('link', { name: linkName }).closest('tr');
  if (!row) {
    throw new Error(`no row for ${linkName}`);
  }
  return row;
}

describe('ProjectsTable', () => {
  it('shows the column headers in order', () => {
    render(<ProjectsTable projects={[makeProject('a')]} />);

    expect(
      screen.getAllByRole('columnheader').map((header) => header.textContent),
    ).toEqual(['Name', 'Last deployment', 'Repository', 'Region', 'Status']);
  });

  it('tells same-name projects apart by region', () => {
    render(
      <ProjectsTable
        projects={[
          makeProject('us'),
          makeProject('eu', {
            region: {
              id: 'eu',
              name: 'eu-central-1',
              countryCode: 'DE',
              city: 'Frankfurt',
            },
          }),
        ]}
      />,
    );

    const usLink = screen.getByRole('link', { name: 'Open shop (us-east-1)' });
    expect(usLink).toHaveAttribute('href', '/orgs/test-org/projects/us');
    expect(
      screen.getByRole('link', { name: 'Open shop (eu-central-1)' }),
    ).toHaveAttribute('href', '/orgs/test-org/projects/eu');

    // The region sits above the row link, never inside it, so clicking it
    // does not open the project.
    const usRegion = screen.getByRole('button', {
      name: 'Region: Virginia (us-east-1)',
    });
    expect(usRegion).toHaveTextContent('Virginia');
    expect(usLink).not.toContainElement(usRegion);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('keeps the plain link name when the region has no name', () => {
    render(
      <ProjectsTable
        projects={[
          makeProject('x', {
            region: { id: 'x', name: '', countryCode: '', city: '' },
          }),
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Open shop' })).toBeInTheDocument();
  });

  it('shows the repository, last deployment, warning and status', () => {
    render(
      <ProjectsTable
        projects={[
          makeProject('a', {
            githubRepository: { fullName: 'nhost/shop' },
            pipelineRuns: [failedRun()],
            appStates: [
              {
                id: 's',
                appId: 'a',
                message: null,
                stateId: ApplicationStatus.Live,
                createdAt: '2026-11-01T00:00:00Z',
              },
            ],
          }),
        ]}
      />,
    );

    const row = within(rowOf('Open shop (us-east-1)'));
    expect(row.getByText('nhost/shop · main')).toBeInTheDocument();
    expect(row.getByText('Ada')).toBeInTheDocument();
    expect(
      row.getByLabelText('The last deployment failed'),
    ).toBeInTheDocument();
    expect(row.getByText('Live')).toBeInTheDocument();
  });

  it('hides deployment and warning without a repository', () => {
    render(
      <ProjectsTable
        projects={[makeProject('a', { pipelineRuns: [failedRun()] })]}
      />,
    );

    const row = within(rowOf('Open shop (us-east-1)'));
    expect(row.queryByText('Ada')).not.toBeInTheDocument();
    expect(
      row.queryByLabelText('The last deployment failed'),
    ).not.toBeInTheDocument();
  });

  it('keeps the full name in the title of long names', () => {
    const name = 'a-very-long-project-name-that-will-not-fit-in-the-cell';
    render(<ProjectsTable projects={[makeProject('a', { name })]} />);

    expect(screen.getByTitle(name)).toBeInTheDocument();
  });

  it('shows Locked with its reason instead of the status', () => {
    render(
      <ProjectsTable
        projects={[
          makeProject('a', {
            isLocked: true,
            isLockedReason: 'Unpaid invoice',
            appStates: [
              {
                id: 's',
                appId: 'a',
                message: null,
                stateId: ApplicationStatus.Paused,
                createdAt: '2026-11-01T00:00:00Z',
              },
            ],
          }),
        ]}
      />,
    );

    const row = within(rowOf('Open shop (us-east-1)'));
    const locked = row.getByRole('button', {
      name: 'Locked: Unpaid invoice',
    });
    expect(locked).toHaveTextContent('Locked');
    expect(row.queryByText('Paused')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open shop (us-east-1)' }),
    ).not.toContainElement(locked);
  });

  it('fills the empty cells of a project without a repository', () => {
    render(<ProjectsTable projects={[makeProject('a')]} />);

    const row = within(rowOf('Open shop (us-east-1)'));
    // A muted dash in Last deployment and Repository alike.
    expect(row.getAllByText('—')).toHaveLength(2);
  });

  it('sorts by last deployment first, then by the clicked column', async () => {
    const deployedAt = (
      startedAt: string,
    ): Project['pipelineRuns'][number] => ({
      ...failedRun(),
      status: PipelineRunStatus_Enum.Succeeded,
      startedAt,
    });
    const repo = { fullName: 'nhost/x' };

    render(
      <ProjectsTable
        projects={[
          makeProject('b', { name: 'beta' }),
          makeProject('c', {
            name: 'charlie',
            githubRepository: repo,
            pipelineRuns: [deployedAt('2026-11-01T00:00:00Z')],
          }),
          makeProject('a', {
            name: 'alpha',
            githubRepository: repo,
            pipelineRuns: [deployedAt('2026-11-10T00:00:00Z')],
          }),
        ]}
      />,
    );

    const names = () =>
      screen
        .getAllByRole('link', { name: /^Open / })
        .map((link) => link.textContent);

    // Newest deployment first, never deployed last.
    expect(names()).toEqual(['alpha', 'charlie', 'beta']);

    const user = new TestUserEvent();
    const nameHeader = screen.getByRole('button', { name: 'Name' });

    await user.click(nameHeader);
    expect(names()).toEqual(['alpha', 'beta', 'charlie']);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    await user.click(nameHeader);
    expect(names()).toEqual(['charlie', 'beta', 'alpha']);
  });
});
