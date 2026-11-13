import { render, screen } from '@/tests/testUtils';
import ProjectsGrid, { type Project } from './ProjectsGrid';

vi.mock('@/features/orgs/projects/hooks/useCurrentOrg', () => ({
  useCurrentOrg: () => ({ org: { slug: 'test-org' } }),
}));

function makeProject(
  subdomain: string,
  region: Project['region'],
  name = 'shop',
): Project {
  return {
    id: subdomain,
    name,
    slug: subdomain,
    createdAt: '2026-11-01T00:00:00Z',
    subdomain,
    repositoryProductionBranch: 'main',
    region,
    githubRepository: null,
    deployments: [],
    pipelineRuns: [],
    creator: null,
    appStates: [],
  };
}

describe('ProjectsGrid', () => {
  it('tells same-name projects apart by region', () => {
    render(
      <ProjectsGrid
        projects={[
          makeProject('us', {
            id: 'us',
            name: 'us-east-1',
            countryCode: 'US',
            city: 'Virginia',
          }),
          makeProject('eu', {
            id: 'eu',
            name: 'eu-central-1',
            countryCode: 'DE',
            city: 'Frankfurt',
          }),
        ]}
      />,
    );

    const usLink = screen.getByRole('link', { name: 'Open shop (us-east-1)' });
    const euLink = screen.getByRole('link', {
      name: 'Open shop (eu-central-1)',
    });
    expect(usLink).toHaveAttribute('href', '/orgs/test-org/projects/us');
    expect(euLink).toHaveAttribute('href', '/orgs/test-org/projects/eu');

    const usFlag = screen.getByRole('button', {
      name: 'Region: Virginia (us-east-1)',
    });
    expect(
      screen.getByRole('button', { name: 'Region: Frankfurt (eu-central-1)' }),
    ).toBeInTheDocument();
    // The flag sits above the link, never inside it, so clicking it
    // does not open the project.
    expect(usLink).not.toContainElement(usFlag);
  });

  it('keeps the plain link name when the region has no name', () => {
    render(
      <ProjectsGrid
        projects={[
          makeProject('x', { id: 'x', name: '', countryCode: '', city: '' }),
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Open shop' })).toBeInTheDocument();
  });
});
