import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import BillingMetricsPreview from '@/features/orgs/components/billing/BillingMetricsPreview/BillingMetricsPreview';
import { Organization_Members_Role_Enum } from '@/generated/graphql';
import { mockOrganization, mockSession } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  queryClient,
  render,
  screen,
  TestUserEvent,
  within,
} from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
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

function makeApps(count: number) {
  return Array.from({ length: count }, (_value, index) => ({
    id: `app-${index}`,
    name: `Project ${index}`,
    subdomain: `project-${index}`,
    slug: `project-${index}`,
    __typename: 'apps' as const,
  }));
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
  it('renders nothing for members who are not organization admins', async () => {
    server.use(organizationHandler({ isAdmin: false }));

    render(<BillingMetricsPreview />);

    await expect(screen.findByText('Billing metrics')).rejects.toBeInstanceOf(
      Error,
    );
  });

  it('renders billing metrics without mock-data disclosures', async () => {
    server.use(organizationHandler());

    render(<BillingMetricsPreview />);

    expect(await screen.findByText('Billing metrics')).toBeInTheDocument();
    expect(screen.queryByText('Preview · Mock data')).not.toBeInTheDocument();
    expect(screen.queryByText('Example data only')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/generated example values/),
    ).not.toBeInTheDocument();
  });

  it('renders finalized service bars and hatches the upcoming estimate', async () => {
    server.use(organizationHandler({ apps: makeApps(2) }));

    const { container } = render(<BillingMetricsPreview />);

    const serviceSection = await screen.findByRole('region', {
      name: 'Monthly service charges',
    });
    const serviceChart = within(serviceSection);
    const serviceFigure = serviceChart.getByRole('figure', {
      name: 'Monthly service charges chart',
    });
    expect(serviceFigure).toBeInTheDocument();
    expect(serviceFigure.parentElement).toHaveClass('items-end');
    expect(serviceFigure.querySelector('[data-chart]')).toHaveStyle({
      height: '480px',
    });
    expect(
      serviceChart.getByText(
        'Four months of charges with a detailed next-invoice estimate.',
      ),
    ).toBeInTheDocument();
    ['May', 'Jun', 'Jul'].forEach((month) => {
      expect(serviceChart.getByText(month)).toBeInTheDocument();
    });
    expect(serviceChart.queryByText('Mar')).not.toBeInTheDocument();
    expect(serviceChart.queryByText('Apr')).not.toBeInTheDocument();
    expect(serviceChart.getByText('Aug (est.)')).toBeInTheDocument();
    expect(
      serviceChart.queryByRole('button', { name: 'Plan' }),
    ).not.toBeInTheDocument();
    expect(
      serviceChart.queryByRole('button', { name: 'Egress' }),
    ).not.toBeInTheDocument();

    const estimateSection = serviceChart.getByRole('region', {
      name: 'Next invoice estimate',
    });
    expect(estimateSection).not.toHaveClass(
      'rounded-lg',
      'border',
      'bg-muted/20',
    );
    expect(
      serviceSection.querySelector('[data-orientation="vertical"]'),
    ).toHaveClass('lg:block');
    const monthlyHeading = serviceChart.getByRole('heading', {
      name: 'Monthly service charges',
    });
    const estimate = within(estimateSection);
    const estimateHeading = estimate.getByRole('heading', {
      name: 'Next invoice estimate',
    });
    expect(estimateHeading).toHaveClass(...monthlyHeading.classList);
    const estimateSubtitle = estimate.getByText(
      'Estimated amount due for August 2026',
    );
    const estimateAmount = estimate.getByText('$265.90');
    expect(
      estimateSubtitle.compareDocumentPosition(estimateAmount) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(estimate.getByText('Estimated total')).toBeInTheDocument();
    const breakdown = within(
      estimate.getByRole('table', {
        name: 'Estimated service charge breakdown',
      }),
    );
    ['Service', 'Share', 'Estimate'].forEach((heading) => {
      expect(
        breakdown.getByRole('columnheader', { name: heading }),
      ).toBeInTheDocument();
    });
    const computeRow = breakdown.getByText('Compute').closest('tr');
    expect(computeRow).not.toBeNull();
    const computeBreakdown = within(computeRow as HTMLElement);
    expect(computeBreakdown.getByText('$100.00')).toBeInTheDocument();
    expect(computeBreakdown.getByText('37.6%')).toBeInTheDocument();
    expect(breakdown.getByText('Plan')).toBeInTheDocument();
    expect(breakdown.getByText('Egress')).toBeInTheDocument();
    expect(estimate.queryByText(/of service charges/)).not.toBeInTheDocument();
    expect(estimate.queryByText('Invoice adjustments')).not.toBeInTheDocument();

    const fills = Array.from(
      container.querySelectorAll('.recharts-rectangle'),
    ).map((bar) => bar.getAttribute('fill') ?? '');
    expect(fills.some((fill) => fill.startsWith('url(#hatch-'))).toBe(true);
    expect(fills.some((fill) => fill.startsWith('var(--color-'))).toBe(true);
    expect(
      serviceChart.queryByRole('button', { name: 'Invoice adjustments' }),
    ).not.toBeInTheDocument();
    expect(
      serviceChart.queryByText(/neutral adjustment series extends below zero/),
    ).not.toBeInTheDocument();
    expect(
      serviceChart.queryByRole('heading', { name: 'Other invoice effects' }),
    ).not.toBeInTheDocument();
  });

  it('filters cumulative project usage without exceeding retained history', async () => {
    server.use(organizationHandler({ apps: makeApps(2) }));
    const user = new TestUserEvent();

    render(<BillingMetricsPreview />);

    const usageSection = await screen.findByRole('region', {
      name: 'Usage by project',
    });
    const serviceSection = screen.getByRole('region', {
      name: 'Monthly service charges',
    });
    expect(
      usageSection.compareDocumentPosition(serviceSection) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
    expect(usageChart.getByText('Invoice · Jul 1')).toBeInTheDocument();
    expect(usageChart.getByText('Invoice · Aug 1')).toBeInTheDocument();
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
    server.use(organizationHandler());
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
    server.use(organizationHandler({ apps: makeApps(2) }));

    render(<BillingMetricsPreview />);

    expect(
      await screen.findByRole('heading', { name: 'Monthly service charges' }),
    ).toBeInTheDocument();
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

  it('does not manufacture project data when the organization has no projects', async () => {
    server.use(organizationHandler({ apps: [] }));

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
