import { useRouter } from 'next/router';
import { vi } from 'vitest';
import DashboardNavigation from '@/components/layout/DashboardNavigation/DashboardNavigation';
import {
  getProjectUrl,
  isHiddenFromPalette,
  type PaletteGating,
  projectPages,
} from '@/features/command-palette/catalog';
import { mockRouter } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

const ORG_SLUG = 'nhost';
const APP_SUBDOMAIN = 'dashboard';
const projectUrl = getProjectUrl(ORG_SLUG, APP_SUBDOMAIN);

const hrefOf = (route: string) =>
  route ? `${projectUrl}/${route}` : projectUrl;

interface Environment {
  label: string;
  platform: boolean;
  configServerUrl: string;
  gating: PaletteGating;
}

const environments: Environment[] = [
  {
    label: 'on the platform',
    platform: true,
    configServerUrl: '',
    gating: { isNotPlatform: false, shouldDisableSettings: false },
  },
  {
    label: 'self-hosted with a config server',
    platform: false,
    configServerUrl: 'https://config.local',
    gating: { isNotPlatform: true, shouldDisableSettings: false },
  },
  {
    label: 'self-hosted without a config server',
    platform: false,
    configServerUrl: '',
    gating: { isNotPlatform: true, shouldDisableSettings: true },
  },
];

function renderProjectNav({ platform, configServerUrl }: Environment) {
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', platform ? 'true' : 'false');
  vi.stubEnv('NEXT_PUBLIC_NHOST_CONFIGSERVER_URL', configServerUrl);
  vi.mocked(useRouter).mockReturnValue({
    ...mockRouter,
    pathname: '/orgs/[orgSlug]/projects/[appSubdomain]',
    route: '/orgs/[orgSlug]/projects/[appSubdomain]',
    asPath: projectUrl,
    query: { orgSlug: ORG_SLUG, appSubdomain: APP_SUBDOMAIN },
  });

  render(<DashboardNavigation />);

  const nav = screen.getByRole('navigation', { name: 'Project navigation' });

  return Array.from(
    nav.querySelectorAll<HTMLElement>('a[href], [aria-disabled="true"]'),
  ).map((item) => ({
    label: item.textContent?.trim() ?? '',
    href: item.getAttribute('href'),
    disabled: item.getAttribute('aria-disabled') === 'true',
  }));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  window.localStorage.removeItem('dashboard-sidebar-collapsed');
});

// The command palette's catalog is the written-down list of project pages;
// the sidebar is hand-laid JSX. Sections give it its own order, so the
// comparison is by set.
describe('ProjectNavigation agrees with the command palette catalog', () => {
  it.each(environments)('links every catalog page $label', (environment) => {
    const items = renderProjectNav(environment);
    const enabled = items.filter((item) => !item.disabled);
    const disabled = items.filter((item) => item.disabled);
    const [reachable, hidden] = projectPages.reduce<
      [(typeof projectPages)[number][], (typeof projectPages)[number][]]
    >(
      ([open, gated], page) =>
        isHiddenFromPalette(page.gate, environment.gating)
          ? [open, [...gated, page]]
          : [[...open, page], gated],
      [[], []],
    );

    expect(items).toHaveLength(projectPages.length);
    expect(enabled.map((item) => item.href).sort()).toEqual(
      reachable.map((page) => hrefOf(page.route)).sort(),
    );
    expect(disabled.map((item) => item.label).sort()).toEqual(
      hidden.map((page) => page.name).sort(),
    );
  });
});
