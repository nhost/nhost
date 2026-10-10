import { useRouter } from 'next/router';
import type { ComponentType } from 'react';
import { vi } from 'vitest';
import {
  getProjectUrl,
  projectSubPagesBySlug,
} from '@/features/command-palette/catalog';
import AIRouteTabs from '@/features/orgs/projects/ai/layout/AIRouteTabs';
import AuthRouteTabs from '@/features/orgs/projects/authentication/layout/AuthRouteTabs';
import DatabaseRouteTabs from '@/features/orgs/projects/database/layout/DatabaseRouteTabs';
import DeploymentsRouteTabs from '@/features/orgs/projects/deployments/layout/DeploymentsRouteTabs';
import EventsRouteTabs from '@/features/orgs/projects/events/layout/EventsRouteTabs';
import GraphQLRouteTabs from '@/features/orgs/projects/graphql/layout/GraphQLRouteTabs';
import MetricsRouteTabs from '@/features/orgs/projects/metrics/layout/MetricsRouteTabs';
import RunRouteTabs from '@/features/orgs/projects/run/layout/RunRouteTabs';
import FunctionsRouteTabs from '@/features/orgs/projects/serverless-functions/layout/FunctionsRouteTabs';
import StorageRouteTabs from '@/features/orgs/projects/storage/layout/StorageRouteTabs';
import { mockRouter } from '@/tests/mocks';
import { render, screen, within } from '@/tests/testUtils';

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/components/common/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));

const projectUrl = getProjectUrl('nhost', 'dashboard');

beforeEach(() => {
  // On the platform no tab is disabled, so every tab renders as a link.
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
  vi.mocked(useRouter).mockReturnValue({
    ...mockRouter,
    asPath: projectUrl,
    query: { orgSlug: 'nhost', appSubdomain: 'dashboard' },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

type Area = keyof typeof projectSubPagesBySlug;

// Every catalog area must be listed here, or this stops type-checking.
const routeTabsByArea = {
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
} satisfies Record<Area, ComponentType>;

// Route tabs are hand-written JSX, while the command palette lists the same
// pages in its catalog. This keeps the two lists from drifting apart.
describe('route tabs list the same pages as the command palette catalog', () => {
  it.each(Object.keys(routeTabsByArea) as Area[])('%s', (area) => {
    const RouteTabs = routeTabsByArea[area];
    render(<RouteTabs />);

    const tabs = within(screen.getByRole('navigation')).getAllByRole('link');

    expect(tabs.map((tab) => tab.getAttribute('href'))).toEqual(
      projectSubPagesBySlug[area].map((page) => `${projectUrl}/${page.route}`),
    );
  });
});
