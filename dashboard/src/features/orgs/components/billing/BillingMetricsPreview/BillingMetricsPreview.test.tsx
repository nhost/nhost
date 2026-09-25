import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import BillingMetricsPreview from '@/features/orgs/components/billing/BillingMetricsPreview/BillingMetricsPreview';
import { Organization_Members_Role_Enum } from '@/generated/graphql';
import { mockOrganization, mockSession } from '@/tests/mocks';
import { billingMetricsQuery } from '@/tests/msw/mocks/graphql/billingMetricsQuery';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  createGraphqlMockResolver,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  useUserData: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

vi.mock('@/hooks/useUserData', () => ({
  useUserData: mocks.useUserData,
}));

const NOW = new Date('2026-08-26T13:37:00.000Z');

const server = setupServer();

function mockChartDimensions(width = 640, height = 320) {
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function measure(this: HTMLElement) {
      if (!this.classList.contains('recharts-responsive-container')) {
        return original.call(this);
      }
      return {
        width,
        height,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    },
  );
}

const TEST_APP_IDS = [
  '9e1b7c7a-5c45-44fc-85bc-7a29f29e8f96',
  'a486b088-50e8-41d0-88b0-5bf9a3e7b5e7',
];

const TEST_DELETED_APP_IDS = [
  'c7fbf7ad-b60c-432b-86c2-5a9509054c47',
  'cd2b77ac-3ef1-4a76-819b-ff1caca09213',
  'cda96570-e636-4028-a729-ac97157faff9',
  'd44dc594-022f-4aa7-84b2-0cebee5f1d13',
  'dc5e805e-1bef-4d43-809e-9fdf865e211a',
  'fc344bc6-1c59-447a-813f-e0f65754b0e0',
];

function makeApps(count: number) {
  return TEST_APP_IDS.slice(0, count).map((id, index) => ({
    id,
    name: `Project ${index}`,
    subdomain: `project-${index}`,
    slug: `project-${index}`,
    __typename: 'apps' as const,
  }));
}

function makeDeletedProjectIDs(count: number) {
  return TEST_DELETED_APP_IDS.slice(0, count);
}

function billingMetricsHandler(
  apps: ReturnType<typeof makeApps>,
  deletedProjectIDs: string[] = [],
) {
  return billingMetricsQuery({
    projects: [
      ...apps.map(({ id, name }) => ({ id, name })),
      ...deletedProjectIDs.map((id) => ({ id, name: id })),
    ],
    now: NOW,
  });
}

function organizationHandler({
  apps = makeApps(1),
  isAdmin = true,
}: {
  apps?: ReturnType<typeof makeApps>;
  isAdmin?: boolean;
} = {}) {
  return nhostGraphQLLink.query('getOrganization', () =>
    HttpResponse.json({
      data: {
        organizations: [
          {
            ...mockOrganization,
            apps,
            members: [
              {
                id: 'member-1',
                role: isAdmin
                  ? Organization_Members_Role_Enum.Admin
                  : Organization_Members_Role_Enum.User,
                user: {
                  id: mockSession.user?.id,
                  email: 'admin@example.com',
                  displayName: 'Admin',
                  avatarUrl: '',
                  __typename: 'users',
                },
                __typename: 'organization_members',
              },
            ],
          },
        ],
      },
    }),
  );
}

beforeAll(() => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_ENV = 'production';
  server.listen();
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  mockChartDimensions();
  mocks.useUserData.mockReturnValue(mockSession.user);
  mocks.useRouter.mockReturnValue({
    basePath: '',
    pathname: '/orgs/xyz/billing',
    route: '/orgs/[orgSlug]/billing',
    asPath: '/orgs/xyz/billing',
    isReady: true,
    isLocaleDomain: false,
    isPreview: false,
    isFallback: false,
    query: { orgSlug: 'xyz' },
    push: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    beforePopState: vi.fn(),
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
  });
});

afterEach(() => {
  vi.useRealTimers();
  server.resetHandlers();
  queryClient.clear();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
});

describe('BillingMetricsPreview', () => {
  it('renders an explicit permission state for resolved non-admin members', async () => {
    server.use(organizationHandler({ isAdmin: false }));

    render(<BillingMetricsPreview />);

    const restrictedState = await screen.findByRole('region', {
      name: 'Billing metrics are restricted',
    });
    expect(restrictedState).toHaveAccessibleDescription(
      'Organization administrator access is required to view billing metrics and usage.',
    );
    expect(
      screen.queryByRole('region', { name: 'Usage by project' }),
    ).not.toBeInTheDocument();
  });

  it('does not flash permission denial while the organization is unresolved', async () => {
    const organization = createGraphqlMockResolver('getOrganization', 'query');
    server.use(organization.handler);

    render(<BillingMetricsPreview />);

    expect(
      screen.queryByRole('heading', {
        name: 'Billing metrics are restricted',
      }),
    ).not.toBeInTheDocument();

    organization.resolve({
      organizations: [
        {
          ...mockOrganization,
          members: [
            {
              id: 'member-1',
              role: Organization_Members_Role_Enum.User,
              user: {
                id: mockSession.user?.id,
                email: 'member@example.com',
                displayName: 'Member',
                avatarUrl: '',
                __typename: 'users',
              },
              __typename: 'organization_members',
            },
          ],
        },
      ],
    });

    expect(
      await screen.findByRole('heading', {
        name: 'Billing metrics are restricted',
      }),
    ).toBeInTheDocument();
  });

  it('does not flash permission denial while user identity is unresolved', async () => {
    const organizationRequest = vi.fn();
    server.use(
      nhostGraphQLLink.query('getOrganization', () => {
        organizationRequest();
        return HttpResponse.json({
          data: {
            organizations: [
              {
                ...mockOrganization,
                members: [],
              },
            ],
          },
        });
      }),
    );
    mocks.useUserData.mockReturnValue(undefined);

    const { rerender } = render(<BillingMetricsPreview />);

    await waitFor(() => expect(organizationRequest).toHaveBeenCalled());
    expect(
      screen.queryByRole('heading', {
        name: 'Billing metrics are restricted',
      }),
    ).not.toBeInTheDocument();

    mocks.useUserData.mockReturnValue(mockSession.user);
    rerender(<BillingMetricsPreview />);

    expect(
      await screen.findByRole('heading', {
        name: 'Billing metrics are restricted',
      }),
    ).toBeInTheDocument();
  });

  it('renders billing metrics without mock-data disclosures', async () => {
    server.use(organizationHandler(), billingMetricsHandler(makeApps(1)));

    render(<BillingMetricsPreview />);

    expect(
      await screen.findByRole('region', { name: 'Usage by project' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Preview · Mock data')).not.toBeInTheDocument();
    expect(screen.queryByText('Example data only')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/generated example values/),
    ).not.toBeInTheDocument();
  });

  it('filters cumulative project usage without exceeding retained history', async () => {
    server.use(
      organizationHandler({ apps: makeApps(2) }),
      billingMetricsHandler(makeApps(2)),
    );
    const user = new TestUserEvent();

    render(<BillingMetricsPreview />);

    const usageSection = await screen.findByRole('region', {
      name: 'Usage by project',
    });
    expect(screen.queryByRole('tab', { name: 'Cost' })).not.toBeInTheDocument();

    const usageChart = within(usageSection);
    expect(
      usageChart.getByText('Month-to-date usage by project.'),
    ).toBeInTheDocument();
    expect(
      usageChart.queryByText(/resets at the UTC monthly billing boundary/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('billingUsageTimeRangeTrigger'),
    ).toHaveTextContent('Current billing cycle');
    expect(
      screen.getByTestId('billingMetricsRefreshButton'),
    ).toHaveAccessibleName('Refresh metrics');
    const usageSummary = within(
      usageChart.getByLabelText('Selected usage summary'),
    );
    expect(usageSummary.getByText('103,900 MB')).toBeInTheDocument();
    expect(
      usageSummary.getByText(
        'Selected period total for Egress across all projects.',
      ),
    ).toBeInTheDocument();
    expect(usageSummary.getByText('Project 1')).toBeInTheDocument();
    expect(
      usageSummary.getByText('56% of selected-period egress · 57,800 MB'),
    ).toBeInTheDocument();
    usageSummary.getAllByRole('article').forEach((card) => {
      expect(card).toHaveClass('rounded-lg', 'bg-muted');
    });
    const egressFigure = usageChart.getByRole('figure', {
      name: 'Egress usage in MB by project',
    });
    expect(egressFigure).toBeInTheDocument();
    expect(egressFigure).toHaveClass('overflow-x-auto');
    expect(egressFigure.querySelector('[data-chart]')).toHaveStyle({
      minWidth: '840px',
    });
    expect(usageChart.queryByText(/Included usage/)).not.toBeInTheDocument();
    expect(
      egressFigure.querySelector('[class*="group-hover:opacity-80"]'),
    ).toHaveClass('opacity-0', 'group-hover:opacity-80');
    ['Aug 1', 'Aug 8', 'Aug 22'].forEach((tick) => {
      expect(usageChart.getByText(tick)).toBeInTheDocument();
    });
    expect(usageChart.getByText('Next invoice · Sep 1')).toBeInTheDocument();
    expect(egressFigure.querySelectorAll('.recharts-rectangle')).toHaveLength(
      52,
    );

    await user.click(screen.getByTestId('billingMetricsRefreshButton'));
    expect(usageSummary.getByText('103,900 MB')).toBeInTheDocument();

    await user.click(screen.getByTestId('billingUsageTimeRangeTrigger'));
    expect(screen.getByText('Quick ranges').closest('[data-side]')).toHaveClass(
      'w-[34rem]',
      'max-w-[calc(100vw-2rem)]',
    );
    await user.click(screen.getByRole('button', { name: 'Last 60 days' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(
      screen.getByTestId('billingUsageTimeRangeTrigger'),
    ).toHaveTextContent('Last 60 days');
    expect(usageSummary.getByText('239,880 MB')).toBeInTheDocument();
    expect(
      usageSummary.getByText('56% of selected-period egress · 133,440 MB'),
    ).toBeInTheDocument();
    expect(
      usageChart.queryByText('Next invoice · Sep 1'),
    ).not.toBeInTheDocument();
    expect(egressFigure.querySelectorAll('.recharts-rectangle')).toHaveLength(
      120,
    );
    const egressBarFills = Array.from(
      egressFigure.querySelectorAll('.recharts-rectangle'),
    ).map((bar) => bar.getAttribute('fill') ?? '');
    expect(
      egressBarFills.filter((fill) => fill.startsWith('url(#hatch-')),
    ).toHaveLength(2);
    expect(
      usageChart.getByRole('button', { name: 'Project 0' }),
    ).toBeInTheDocument();
    expect(
      usageChart.getByRole('button', { name: 'Project 1' }),
    ).toBeInTheDocument();

    await user.click(
      usageChart.getByRole('tab', { name: 'Function duration' }),
    );
    expect(
      usageChart.getByRole('figure', {
        name: 'Function duration usage in seconds by project',
      }),
    ).toBeInTheDocument();
    expect(usageChart.queryByText(/Included usage/)).not.toBeInTheDocument();

    await user.click(usageChart.getByRole('tab', { name: 'Compute' }));
    expect(
      usageChart.getByRole('figure', {
        name: 'Compute usage in millicore-minutes by project',
      }),
    ).toBeInTheDocument();
    expect(usageChart.queryByText(/Included usage/)).not.toBeInTheDocument();
  });

  it('shows only resource values currently tracked by billing', async () => {
    server.use(organizationHandler(), billingMetricsHandler(makeApps(1)));
    const user = new TestUserEvent();

    render(<BillingMetricsPreview />);

    const resourceSection = await screen.findByRole('region', {
      name: 'Current tracked resources',
    });
    const table = within(resourceSection);
    expect(
      table.getByText('Current billable resources by project.'),
    ).toBeInTheDocument();
    expect(table.getByText('1,000 millicores')).toBeInTheDocument();
    expect(table.getByText('Deployed functions')).toBeInTheDocument();
    expect(table.getByText('10 GB')).toBeInTheDocument();
    expect(table.getByText('PITR')).toBeInTheDocument();

    const pricingTooltips = [
      {
        name: 'Compute pricing for Pro and Team plans',
        content: '$0.0012 per vCPU-minute',
      },
      {
        name: 'Deployed functions pricing for Pro and Team plans',
        content: '50 functions included, then $5 per additional 50 functions.',
      },
      {
        name: 'Custom domains pricing for Pro and Team plans',
        content: '$10 per project per month.',
      },
      {
        name: 'Persistent volume pricing for Pro and Team plans',
        content:
          '10 GB included, then $0.20 per additional GB. Includes persistent storage used by Database and Nhost Run services.',
      },
      {
        name: 'PITR pricing for Pro and Team plans',
        content: 'Starts at $100 per project with 7 days of retention.',
      },
    ];

    for (const tooltip of pricingTooltips) {
      const trigger = table.getByRole('button', { name: tooltip.name });
      await user.hover(trigger);
      expect(await screen.findByRole('tooltip')).toHaveTextContent(
        tooltip.content,
      );
      await user.unhover(trigger);
    }
  });

  it('does not render unsupported project cost attribution', async () => {
    server.use(
      organizationHandler({ apps: makeApps(2) }),
      billingMetricsHandler(makeApps(2)),
    );

    render(<BillingMetricsPreview />);

    expect(
      await screen.findByRole('region', { name: 'Usage by project' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Monthly service charges' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Next invoice estimate' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        name: 'Attributed usage spend by project',
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Current cost drivers' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Estimated project share'),
    ).not.toBeInTheDocument();
  });

  it('labels deleted projects by a trimmed ID and explains them', async () => {
    const deletedProjectIDs = makeDeletedProjectIDs(2);
    server.use(
      organizationHandler(),
      billingMetricsHandler(makeApps(1), deletedProjectIDs),
    );
    const user = new TestUserEvent();

    render(<BillingMetricsPreview />);

    const usageChart = within(
      await screen.findByRole('region', { name: 'Usage by project' }),
    );
    const figure = within(
      usageChart.getByRole('figure', { name: 'Egress usage in MB by project' }),
    );
    expect(
      figure.getByRole('button', { name: 'Project 0' }),
    ).toBeInTheDocument();
    expect(
      figure.getByRole('button', { name: 'Deleted · c7fbf7ad…4c47' }),
    ).toBeInTheDocument();
    expect(
      figure.getByRole('button', { name: 'Deleted · cd2b77ac…9213' }),
    ).toBeInTheDocument();

    const legendInfo = figure.getByRole('button', {
      name: 'About deleted project c7fbf7ad…4c47',
    });
    await user.hover(legendInfo);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(
      'deleted or moved to another organization',
    );
    expect(tooltip).toHaveTextContent(deletedProjectIDs[0]);
    await user.unhover(legendInfo);

    const usageSummary = within(
      usageChart.getByLabelText('Selected usage summary'),
    );
    expect(usageSummary.getByText('Deleted project')).toBeInTheDocument();
    expect(usageSummary.getByText('cd2b77ac…9213')).toBeInTheDocument();
    expect(
      usageSummary.getByText(
        /Includes [\d,]+ MB \(\d+%\) from 2 deleted projects\.$/,
      ),
    ).toBeInTheDocument();

    const resourceRows = within(
      screen.getByRole('region', { name: 'Current tracked resources' }),
    )
      .getAllByRole('row')
      .slice(1);
    expect(resourceRows[0]).toHaveTextContent('Project 0');
    expect(
      within(resourceRows[1]).getByText('Deleted project'),
    ).toBeInTheDocument();
    expect(
      within(resourceRows[1]).getByText('c7fbf7ad…4c47'),
    ).toBeInTheDocument();
  });

  it('groups more than five deleted projects into one legend entry', async () => {
    const deletedProjectIDs = makeDeletedProjectIDs(6);
    server.use(
      organizationHandler(),
      billingMetricsHandler(makeApps(1), deletedProjectIDs),
    );
    const user = new TestUserEvent();

    render(<BillingMetricsPreview />);

    const usageChart = within(
      await screen.findByRole('region', { name: 'Usage by project' }),
    );
    const figure = within(
      usageChart.getByRole('figure', { name: 'Egress usage in MB by project' }),
    );
    expect(
      figure.getByRole('button', { name: 'Deleted projects (6)' }),
    ).toBeInTheDocument();
    expect(
      figure.queryByRole('button', { name: /^Deleted · / }),
    ).not.toBeInTheDocument();

    await user.hover(
      figure.getByRole('button', { name: 'About 6 deleted projects' }),
    );
    const tooltip = await screen.findByRole('tooltip');
    deletedProjectIDs.forEach((projectID) => {
      expect(tooltip).toHaveTextContent(projectID);
    });

    const usageSummary = within(
      usageChart.getByLabelText('Selected usage summary'),
    );
    expect(usageSummary.getByText('Deleted project')).toBeInTheDocument();
    expect(
      usageSummary.queryByText(/Deleted projects/),
    ).not.toBeInTheDocument();
    expect(
      usageSummary.getByText(/from 6 deleted projects\.$/),
    ).toBeInTheDocument();
  });

  it('does not manufacture project data when the organization has no projects', async () => {
    server.use(organizationHandler({ apps: [] }), billingMetricsHandler([]));

    render(<BillingMetricsPreview />);

    expect(
      await screen.findByText(
        'No tracked resources are available because this organization has no projects.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No egress reports are available.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Other projects')).not.toBeInTheDocument();
  });
});
