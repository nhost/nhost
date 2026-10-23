import { cloneElement, type ReactElement } from 'react';
import type { BillingUsageReport } from '@/features/orgs/components/billing/BillingUsage/types';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import BillingUsageByProject from './BillingUsageByProject';

// jsdom has no layout, so the chart gets a fixed size to render its legend.
vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactElement }) =>
    cloneElement(children, { width: 800, height: 300 } as never),
}));

const now = new Date();

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
    reportEnds: now.toISOString(),
  };
}

const data = {
  currentCycle: {
    start: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    ).toISOString(),
    end: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    ).toISOString(),
  },
  usageReports: [
    report('alpha-id', 'Alpha', 'egress'),
    report('beta-id', 'Beta', 'egress'),
    report('alpha-id', 'Alpha', 'functions'),
    report('beta-id', 'Beta', 'functions'),
  ],
  trackedResources: [],
};

describe('BillingUsageByProject', () => {
  it('shows every project again after switching meters', async () => {
    const user = new TestUserEvent();
    render(
      <BillingUsageByProject
        data={data}
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
        data={data}
        refreshing={false}
        onRefresh={vi.fn()}
        showIncludedUsage
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Beta' }));
    rerender(
      <BillingUsageByProject
        data={{
          ...data,
          usageReports: data.usageReports.filter(
            (usageReport) => usageReport.projectID !== 'beta-id',
          ),
        }}
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
    const lastMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 10),
    ).toISOString();
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
        data={{
          ...data,
          usageReports: [...data.usageReports, ...deletedReports],
        }}
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
