import { useRouter } from 'next/router';
import { vi } from 'vitest';
import { DashboardNavigation } from '@/components/layout/DashboardNavigation';
import {
  getProjectUrl,
  projectPages,
} from '@/features/command-palette/catalog';
import { mockRouter } from '@/tests/mocks';
import { render, screen, within } from '@/tests/testUtils';

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

const projectUrl = getProjectUrl('nhost', 'dashboard');

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  window.localStorage.removeItem('dashboard-sidebar-collapsed');
});

// The sidebar is hand-written JSX, while the command palette lists the same
// pages in its catalog. This keeps the two lists from drifting apart. The
// sidebar groups pages into sections, so the order is not compared.
describe('ProjectNavigation lists the same pages as the command palette catalog', () => {
  it('links every catalog page', () => {
    // On the platform no item is disabled, so every item renders as a link.
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
    vi.mocked(useRouter).mockReturnValue({
      ...mockRouter,
      pathname: '/orgs/[orgSlug]/projects/[appSubdomain]',
      asPath: projectUrl,
      query: { orgSlug: 'nhost', appSubdomain: 'dashboard' },
    });

    render(<DashboardNavigation />);

    const nav = screen.getByRole('navigation', { name: 'Project navigation' });
    const links = within(nav).getAllByRole('link');

    expect(links.map((link) => link.getAttribute('href')).sort()).toEqual(
      projectPages
        .map((page) =>
          page.route ? `${projectUrl}/${page.route}` : projectUrl,
        )
        .sort(),
    );
  });
});
