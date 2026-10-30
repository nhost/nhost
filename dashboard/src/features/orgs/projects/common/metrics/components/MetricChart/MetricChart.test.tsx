import { cloneElement, type ReactElement } from 'react';
import { act, render, screen, TestUserEvent } from '@/tests/testUtils';
import MetricChart from './MetricChart';

// jsdom has no layout, so the chart gets a fixed size to render its plot and
// legend.
vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactElement }) =>
    cloneElement(children, { width: 800, height: 300 } as never),
}));

const accessors = {
  keyFor: (labels: Record<string, string>) => labels.name,
  labelFor: (_key: string, labels: Record<string, string>) => labels.name,
  colorFor: () => 'hsl(0 0% 50%)',
};

const data = ['Alpha', 'Beta'].map((name) => ({
  labels: { name },
  timestamps: [
    '2026-10-01T00:00:00.000Z',
    '2026-10-01T00:01:00.000Z',
    '2026-10-01T00:02:00.000Z',
  ],
  datapoints: [1, 2, 3],
}));

// A click pins the data point under the hover, which Recharts applies on the
// next animation frame.
async function pinDataPoint(user: TestUserEvent) {
  const plot = screen.getByRole('application');
  const coords = { clientX: 400, clientY: 150 };
  await user.pointer({ target: plot, coords });
  await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await user.pointer({ keys: '[MouseLeft]', target: plot, coords });

  expect(
    screen.getByRole('dialog', { name: 'Pinned data point' }),
  ).toBeInTheDocument();
}

describe('MetricChart', () => {
  it('closes the pinned tooltip when a legend item is clicked, without pinning it again', async () => {
    const user = new TestUserEvent();
    render(<MetricChart data={data} accessors={accessors} />);

    await pinDataPoint(user);
    await user.click(screen.getByRole('button', { name: 'Alpha' }));

    expect(
      screen.queryByRole('dialog', { name: 'Pinned data point' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beta' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await user.click(screen.getByRole('button', { name: 'Alpha' }));

    expect(
      screen.queryByRole('dialog', { name: 'Pinned data point' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beta' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('does not pin a tooltip when a legend item is clicked', async () => {
    const user = new TestUserEvent();
    render(<MetricChart data={data} accessors={accessors} />);

    await user.click(screen.getByRole('button', { name: 'Alpha' }));

    expect(
      screen.queryByRole('dialog', { name: 'Pinned data point' }),
    ).not.toBeInTheDocument();
  });
});
