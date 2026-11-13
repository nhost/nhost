import { render, screen } from '@/tests/testUtils';
import TooltipFooter from './TooltipFooter';

function entry(key: string, value: number) {
  return { key, label: key, value, color: 'transparent' };
}

describe('TooltipFooter', () => {
  it('shows how much of the included usage the total uses', () => {
    render(
      <TooltipFooter
        entries={[entry('alpha', 12_000), entry('beta', 7_500)]}
        totalLabel="Month-to-date egress"
        referenceLines={[{ value: 50_000, label: 'the 50,000 MB included' }]}
        valueFormatter={(value) => `${value.toLocaleString('en-US')} MB`}
      />,
    );

    expect(screen.getByText('Month-to-date egress')).toBeInTheDocument();
    expect(
      screen.getByText('39% of the 50,000 MB included'),
    ).toBeInTheDocument();
  });
});
