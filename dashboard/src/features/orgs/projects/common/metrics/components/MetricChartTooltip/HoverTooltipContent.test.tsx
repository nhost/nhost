import { render, screen } from '@/tests/testUtils';
import HoverTooltipContent from './HoverTooltipContent';

const payload = [1, 2, 4, 8, 16].map((value) => ({
  dataKey: `project-${value}`,
  value,
}));

const config = Object.fromEntries(
  payload.map(({ dataKey, value }) => [dataKey, { label: `Project ${value}` }]),
);

describe('HoverTooltipContent', () => {
  it('lists the largest entries and sums the rest into one row', () => {
    render(
      <HoverTooltipContent
        active
        payload={payload}
        config={config}
        label={Date.UTC(2026, 9, 1)}
        maxEntries={3}
        valueFormatter={(value) => `${value} GB`}
        renderFooter={(entries) => <p>Total of {entries.length} projects</p>}
      />,
    );

    expect(screen.getByText('Project 16')).toBeInTheDocument();
    expect(screen.getByText('Project 8')).toBeInTheDocument();
    expect(screen.getByText('Project 4')).toBeInTheDocument();
    expect(screen.queryByText('Project 2')).not.toBeInTheDocument();
    expect(screen.getByText('+2 more')).toBeInTheDocument();
    expect(screen.getByText('3 GB')).toBeInTheDocument();
    expect(screen.getByText('Total of 5 projects')).toBeInTheDocument();
  });
});
