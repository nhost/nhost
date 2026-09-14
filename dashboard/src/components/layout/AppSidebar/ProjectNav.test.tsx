import { useRouter } from 'next/router';
import { vi } from 'vitest';
import { AppSidebar } from '@/components/layout/AppSidebar';
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
describe('ProjectNav lists the same pages as the command palette catalog', () => {
  it('links every catalog page', () => {
    // On the platform no item is disabled, so every item renders as a link.
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
    vi.mocked(useRouter).mockReturnValue({
      ...mockRouter,
      pathname: '/orgs/[orgSlug]/projects/[appSubdomain]',
      asPath: projectUrl,
      query: { orgSlug: 'nhost', appSubdomain: 'dashboard' },
    });

    render(<AppSidebar />);

    // The sidebar landmark, not its <nav>: Settings lives in the footer.
    const sidebar = screen.getByRole('complementary', {
      name: 'Project navigation',
    });
    const links = within(sidebar).getAllByRole('link');

    expect(links.map((link) => link.getAttribute('href')).sort()).toEqual(
      projectPages
        .map((page) =>
          page.route ? `${projectUrl}/${page.route}` : projectUrl,
        )
        .sort(),
    );
  });
});
