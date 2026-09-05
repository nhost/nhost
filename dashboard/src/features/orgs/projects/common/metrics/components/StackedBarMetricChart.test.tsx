import StackedBarMetricChart from '@/features/orgs/projects/common/metrics/components/StackedBarMetricChart';
import type {
  MetricSeries,
  SeriesAccessors,
} from '@/features/orgs/projects/common/metrics/types';
import {
  fireEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';

const accessors: SeriesAccessors = {
  keyFor: (labels) => labels.seriesKey,
  labelFor: (key, labels) => labels.seriesLabel ?? key,
  colorFor: (_key, labels) => labels.seriesColor,
};

const MONTHS = [
  '2026-06-01T00:00:00.000Z',
  '2026-07-01T00:00:00.000Z',
  '2026-08-01T00:00:00.000Z',
];

function series(
  seriesKey: string,
  seriesLabel: string,
  datapoints: number[],
): MetricSeries {
  return {
    labels: { seriesKey, seriesLabel, seriesColor: 'hsl(220 70% 50%)' },
    timestamps: MONTHS,
    datapoints,
  };
}

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

beforeEach(() => {
  mockChartDimensions();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('StackedBarMetricChart', () => {
  it('renders the configured empty state', () => {
    render(
      <StackedBarMetricChart
        data={[]}
        accessors={accessors}
        emptyLabel="No invoice history."
      />,
    );

    expect(screen.getByText('No invoice history.')).toBeInTheDocument();
  });

  it('labels every series and exposes the chart region', () => {
    render(
      <StackedBarMetricChart
        data={[
          series('compute', 'Compute', [100, 120, 90]),
          series('plan', 'Plan', [25, 25, 25]),
        ]}
        accessors={accessors}
        ariaLabel="Monthly charges"
      />,
    );

    expect(
      screen.getByRole('figure', { name: 'Monthly charges' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compute' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Plan' })).toBeInTheDocument();
  });

  it('can hide the interactive legend', () => {
    render(
      <StackedBarMetricChart
        data={[
          series('compute', 'Compute', [100, 120, 90]),
          series('plan', 'Plan', [25, 25, 25]),
        ]}
        accessors={accessors}
        showLegend={false}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Compute' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Plan' }),
    ).not.toBeInTheDocument();
  });

  it('keeps reference lines unlabeled and visible only on graph hover', () => {
    const { container } = render(
      <StackedBarMetricChart
        data={[series('egress', 'Egress', [100, 120, 190])]}
        accessors={accessors}
        referenceLines={[{ value: 150, label: 'Included usage' }]}
      />,
    );

    expect(screen.queryByText(/Included usage/)).not.toBeInTheDocument();
    expect(
      container.querySelector('[class*="group-hover:opacity-80"]'),
    ).toHaveClass('opacity-0', 'group-hover:opacity-80');
  });

  it('uses the primary line color for included usage in the tooltip', async () => {
    const { container } = render(
      <StackedBarMetricChart
        data={[series('egress', 'Egress', [100, 120, 190])]}
        accessors={accessors}
        referenceLines={[{ value: 150, label: 'Included usage' }]}
      />,
    );

    fireEvent.mouseMove(
      container.querySelector('.recharts-wrapper') as Element,
      { clientX: 320, clientY: 100 },
    );

    await waitFor(() => {
      expect(
        screen.getByText('Included usage').querySelector('span'),
      ).toHaveClass('border-primary');
    });
  });

  it('pins a selectable tooltip on click and closes it explicitly', async () => {
    const user = new TestUserEvent();
    const { container } = render(
      <StackedBarMetricChart
        data={[
          series('compute', 'Compute', [100, 120, 90]),
          series('plan', 'Plan', [25, 25, 25]),
        ]}
        accessors={accessors}
        valueFormatter={(value) => `${value} units`}
        referenceLines={[{ value: 150, label: 'Included usage' }]}
      />,
    );
    const chart = container.querySelector('.recharts-wrapper') as Element;

    fireEvent.mouseMove(chart, { clientX: 320, clientY: 100 });
    await waitFor(() => {
      expect(screen.getByText('Included usage')).toBeInTheDocument();
    });
    fireEvent.click(chart, { clientX: 320, clientY: 100 });

    const pinned = await screen.findByRole('dialog', {
      name: 'Pinned data point',
    });
    expect(pinned).toHaveClass('pointer-events-auto', 'select-text');
    expect(within(pinned).getByText('Compute')).toBeInTheDocument();
    expect(within(pinned).getByText('Plan')).toBeInTheDocument();
    expect(within(pinned).getByText('Included usage')).toBeInTheDocument();
    expect(within(pinned).getByText('Total')).toBeInTheDocument();

    fireEvent.mouseLeave(chart);
    expect(pinned).toBeInTheDocument();

    await user.click(
      within(pinned).getByRole('button', { name: 'Close pinned tooltip' }),
    );
    expect(
      screen.queryByRole('dialog', { name: 'Pinned data point' }),
    ).not.toBeInTheDocument();
  });

  it('contains hover overflow and anchors boundary labels inside the plot', () => {
    const { container } = render(
      <StackedBarMetricChart
        data={[series('egress', 'Egress', [100, 120, 190])]}
        accessors={accessors}
        verticalReferenceLines={[
          {
            value: new Date(MONTHS[1]).getTime(),
            label: 'Invoice · Jul 1',
          },
          {
            value: new Date(MONTHS[2]).getTime(),
            label: 'Invoice · Aug 1',
          },
        ]}
        timeDomain={[
          new Date('2026-06-27T00:00:00.000Z').getTime(),
          new Date('2026-08-26T00:00:00.000Z').getTime(),
        ]}
      />,
    );

    expect(container.querySelector('[data-chart]')).toHaveClass(
      'overflow-hidden',
    );
    expect(screen.getByText('Invoice · Jul 1').closest('text')).toHaveAttribute(
      'text-anchor',
      'start',
    );
    expect(screen.getByText('Invoice · Aug 1').closest('text')).toHaveAttribute(
      'text-anchor',
      'end',
    );
  });

  it('hatches only bars with marked timestamps', () => {
    const { container } = render(
      <StackedBarMetricChart
        data={[
          series('compute', 'Compute', [100, 120, 90]),
          series('plan', 'Plan', [25, 25, 25]),
        ]}
        accessors={accessors}
        hatchedTimestamps={[new Date(MONTHS[2]).getTime()]}
      />,
    );

    const fills = Array.from(
      container.querySelectorAll('.recharts-rectangle'),
    ).map((bar) => bar.getAttribute('fill') ?? '');
    expect(fills.filter((fill) => fill.startsWith('url(#hatch-'))).toHaveLength(
      2,
    );
    expect(
      fills.filter((fill) => fill.startsWith('var(--color-')),
    ).toHaveLength(4);
  });

  it('isolates and restores a series through the legend', async () => {
    const user = new TestUserEvent();
    render(
      <StackedBarMetricChart
        data={[
          series('compute', 'Compute', [100, 120, 90]),
          series('plan', 'Plan', [25, 25, 25]),
        ]}
        accessors={accessors}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Compute' }));
    expect(screen.getByRole('button', { name: 'Plan' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await user.click(screen.getByRole('button', { name: 'Compute' }));
    expect(screen.getByRole('button', { name: 'Plan' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
