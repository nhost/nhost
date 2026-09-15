import { useRouter } from 'next/router';
import type { ComponentType } from 'react';
import { vi } from 'vitest';
import {
  getProjectUrl,
  isHiddenFromPalette,
  type PaletteGating,
  projectPages,
  projectSubPagesBySlug,
} from '@/features/command-palette/catalog';
import { AIRouteTabs } from '@/features/orgs/projects/ai/layout';
import { AuthRouteTabs } from '@/features/orgs/projects/authentication/layout';
import { DatabaseRouteTabs } from '@/features/orgs/projects/database/layout';
import { DeploymentsRouteTabs } from '@/features/orgs/projects/deployments/layout';
import { EventsRouteTabs } from '@/features/orgs/projects/events/layout';
import { GraphQLRouteTabs } from '@/features/orgs/projects/graphql/layout';
import { MetricsRouteTabs } from '@/features/orgs/projects/metrics/layout';
import { RunRouteTabs } from '@/features/orgs/projects/run/layout';
import { FunctionsRouteTabs } from '@/features/orgs/projects/serverless-functions/layout';
import { StorageRouteTabs } from '@/features/orgs/projects/storage/layout';
import { mockRouter } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

const ORG_SLUG = 'nhost';
const APP_SUBDOMAIN = 'dashboard';
const projectUrl = getProjectUrl(ORG_SLUG, APP_SUBDOMAIN);

type AreaSlug = keyof typeof projectSubPagesBySlug;

const areaTabs: Record<AreaSlug, ComponentType> = {
  database: DatabaseRouteTabs,
  graphql: GraphQLRouteTabs,
  events: EventsRouteTabs,
  auth: AuthRouteTabs,
  storage: StorageRouteTabs,
  functions: FunctionsRouteTabs,
  run: RunRouteTabs,
  deployments: DeploymentsRouteTabs,
  metrics: MetricsRouteTabs,
  ai: AIRouteTabs,
};

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

const cases = (Object.keys(areaTabs) as AreaSlug[]).flatMap((area) =>
  environments.map((environment) => ({ area, environment })),
);

function renderTabs(
  area: AreaSlug,
  { platform, configServerUrl }: Environment,
) {
  const [first] = projectSubPagesBySlug[area];

  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', platform ? 'true' : 'false');
  vi.stubEnv('NEXT_PUBLIC_NHOST_CONFIGSERVER_URL', configServerUrl);
  vi.mocked(useRouter).mockReturnValue({
    ...mockRouter,
    pathname: `/orgs/[orgSlug]/projects/[appSubdomain]/${first.route}`,
    route: `/orgs/[orgSlug]/projects/[appSubdomain]/${first.route}`,
    asPath: `${projectUrl}/${first.route}`,
    query: { orgSlug: ORG_SLUG, appSubdomain: APP_SUBDOMAIN },
  });

  const Tabs = areaTabs[area];
  render(<Tabs />);

  return Array.from(
    screen
      .getByRole('navigation')
      .querySelectorAll<HTMLElement>('a[href], [aria-disabled="true"]'),
  ).map((tab) => ({
    href: tab.getAttribute('href'),
    disabled: tab.getAttribute('aria-disabled') === 'true',
  }));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

// The command palette's catalog lists each area's sub-pages in tab order; the
// tabs are hand-laid JSX. A tab is expected to be disabled when its own page
// or the whole area is hidden from the palette in that environment.
describe('route tabs agree with the command palette catalog', () => {
  it.each(cases)(
    '$area tabs match the catalog $environment.label',
    ({ area, environment }) => {
      const pages = projectSubPagesBySlug[area];
      const areaGate = projectPages.find((page) => page.slug === area)?.gate;
      const tabs = renderTabs(area, environment);

      expect(tabs).toEqual(
        pages.map((page) => {
          const disabled =
            isHiddenFromPalette(areaGate, environment.gating) ||
            isHiddenFromPalette(page.gate, environment.gating);

          return {
            href: disabled ? null : `${projectUrl}/${page.route}`,
            disabled,
          };
        }),
      );
    },
  );
});
