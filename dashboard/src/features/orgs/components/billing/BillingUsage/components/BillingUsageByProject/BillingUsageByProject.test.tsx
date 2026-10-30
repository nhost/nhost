import type { ParsedUrlQuery } from 'node:querystring';
import { cloneElement, type ReactElement } from 'react';
import type { BillingUsageReport } from '@/features/orgs/components/billing/BillingUsage/types';
import { render, screen, TestUserEvent, within } from '@/tests/testUtils';
import BillingUsageByProject from './BillingUsageByProject';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

function setUrlQuery(query: ParsedUrlQuery) {
  mocks.useRouter.mockReturnValue({
    pathname: '/orgs/[orgSlug]/billing/usage',
    query,
    replace: vi.fn(),
  });
}

// jsdom has no layout, so the chart gets a fixed size to render its legend.
vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactElement }) =>
    cloneElement(children, { width: 800, height: 300 } as never),
}));

// Fixed dates in the middle of a billing cycle, so the reports are in the
// current cycle in the tests' time zone, Europe/Helsinki, whenever the tests
// run.
const REPORT_END = '2026-10-15T12:00:00.000Z';

function report(
  projectID: string,
  projectName: string,
  type: BillingUsageReport['type'],
): BillingUsageReport {
  return {
    projectID,
    projectName,
    isDeleted: false,
    type,
    value: 10,
    reportEnds: REPORT_END,
  };
}

const currentCycle = {
  start: '2026-10-01T00:00:00.000Z',
  end: '2026-11-01T00:00:00.000Z',
};

const usageReports = [
  report('alpha-id', 'Alpha', 'egress'),
  report('beta-id', 'Beta', 'egress'),
  report('alpha-id', 'Alpha', 'functions'),
  report('beta-id', 'Beta', 'functions'),
];

function renderUsage() {
  return render(
    <BillingUsageByProject
      usageReports={usageReports}
      currentCycle={currentCycle}
      refreshing={false}
      onRefresh={vi.fn()}
      showIncludedUsage
    />,
  );
}

describe('BillingUsageByProject', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setUrlQuery({});
  });

  it('marks the previous billing cycle as partial when its first days are no longer available', () => {
    // The reports go back to Jul 3 in the tests' time zone, Europe/Helsinki,
    // and the previous cycle started on Jul 1.
    setUrlQuery({ usageRange: 'previousBillingCycle' });

    render(
      <BillingUsageByProject
        usageReports={[
          {
            ...report('alpha-id', 'Alpha', 'egress'),
            reportEnds: '2026-07-03T08:00:00.000Z',
          },
          {
            ...report('alpha-id', 'Alpha', 'egress'),
            reportEnds: '2026-08-31T08:00:00.000Z',
          },
        ]}
        currentCycle={{
          start: '2026-08-01T00:00:00.000Z',
          end: '2026-09-01T00:00:00.000Z',
        }}
        refreshing={false}
        onRefresh={vi.fn()}
        showIncludedUsage
      />,
    );

    expect(
      screen.getByRole('button', {
        name: 'Previous billing cycle · Jul 3 – Aug 1 (partial)',
      }),
    ).toBeInTheDocument();
  });

  it('includes the usage reported between a late renewal and midnight in the current billing cycle', () => {
    // The cycle starts on Dec 1 at 5 PM in Europe/Helsinki. Alpha's report is
    // from before it, and Beta's from 10 PM.
    render(
      <BillingUsageByProject
        usageReports={[
          {
            ...report('alpha-id', 'Alpha', 'egress'),
            reportEnds: '2026-12-01T12:00:00.000Z',
          },
          {
            ...report('beta-id', 'Beta', 'egress'),
            reportEnds: '2026-12-01T20:00:00.000Z',
          },
        ]}
        currentCycle={{
          start: '2026-12-01T15:00:00.000Z',
          end: '2027-01-01T15:00:00.000Z',
        }}
        refreshing={false}
        onRefresh={vi.fn()}
        showIncludedUsage
      />,
    );

    expect(screen.getByRole('button', { name: 'Beta' })).toBeInTheDocument();
    expect(
      within(
        screen.getByRole('region', { name: 'Selected usage summary' }),
      ).getByText('10 MB'),
    ).toBeInTheDocument();
  });

  it('keeps the chart view chosen in this browser', async () => {
    const user = new TestUserEvent();
    const { unmount } = renderUsage();

    expect(
      screen.getByText(
        'Usage by project, added up from the start of each billing cycle.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Daily' }));

    expect(
      screen.getByText('Usage by project for each day.'),
    ).toBeInTheDocument();

    unmount();
    renderUsage();

    expect(screen.getByRole('tab', { name: 'Daily' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByText('Usage by project for each day.'),
    ).toBeInTheDocument();
  });

  it('shows every project again after switching meters', async () => {
    const user = new TestUserEvent();
    render(
      <BillingUsageByProject
        usageReports={usageReports}
        currentCycle={currentCycle}
        refreshing={false}
        onRefresh={vi.fn()}
        showIncludedUsage
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Alpha' }));
    expect(screen.getByRole('button', { name: 'Beta' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await user.click(screen.getByRole('tab', { name: 'Function duration' }));

    expect(screen.getByRole('button', { name: 'Beta' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows every project again when the only visible one leaves the chart', async () => {
    const user = new TestUserEvent();
    const { rerender } = render(
      <BillingUsageByProject
        usageReports={usageReports}
        currentCycle={currentCycle}
        refreshing={false}
        onRefresh={vi.fn()}
        showIncludedUsage
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Beta' }));
    rerender(
      <BillingUsageByProject
        usageReports={usageReports.filter(
          (usageReport) => usageReport.projectID !== 'beta-id',
        )}
        currentCycle={currentCycle}
        refreshing={false}
        onRefresh={vi.fn()}
        showIncludedUsage
      />,
    );

    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('leaves out deleted projects with no usage in the selected range', () => {
    const lastMonth = '2026-09-10T00:00:00.000Z';
    const deletedReports = Array.from({ length: 6 }, (_, index) => ({
      projectID: `gone-${index}`,
      projectName: `gone-${index}`,
      isDeleted: true,
      type: 'egress' as const,
      value: 5,
      reportEnds: lastMonth,
    }));

    render(
      <BillingUsageByProject
        usageReports={[...usageReports, ...deletedReports]}
        currentCycle={currentCycle}
        refreshing={false}
        onRefresh={vi.fn()}
        showIncludedUsage
      />,
    );

    expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Deleted/ }),
    ).not.toBeInTheDocument();
  });
});
