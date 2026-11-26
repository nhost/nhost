import { cloneElement, type ReactElement } from 'react';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import StackedBarMetricChart from './StackedBarMetricChart';

// jsdom has no layout, so the chart gets a fixed size to render its legend.
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
  timestamps: ['2026-10-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z'],
  datapoints: [1, 2],
}));

describe('StackedBarMetricChart', () => {
  it('keeps focus on a legend item toggled with the keyboard', async () => {
    const user = new TestUserEvent();
    render(<StackedBarMetricChart data={data} accessors={accessors} />);

    screen.getByRole('button', { name: 'Alpha' }).focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('button', { name: 'Beta' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveFocus();
  });
});
