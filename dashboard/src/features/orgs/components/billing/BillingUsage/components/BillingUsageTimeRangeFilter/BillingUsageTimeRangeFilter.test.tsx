import { useState } from 'react';
import type {
  BillingUsageRangeBounds,
  BillingUsageTimeRange,
  BillingUsageTimeZone,
} from '@/features/orgs/components/billing/BillingUsage/types';
import {
  mockScrollIntoViewAndPointerCapture,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';
import BillingUsageTimeRangeFilter from './BillingUsageTimeRangeFilter';

// Aug 8 to Oct 6 in the tests' browser time zone, Europe/Helsinki.
const BOUNDS: BillingUsageRangeBounds = {
  min: '2026-08-07T21:00:00.000Z',
  max: '2026-10-06T21:00:00.000Z',
  currentBillingCycle: {
    start: '2026-10-01T00:00:00.000Z',
    end: '2026-11-01T00:00:00.000Z',
  },
};

function FilterOnPage({ bounds }: { bounds: BillingUsageRangeBounds }) {
  const [range, setRange] = useState<BillingUsageTimeRange>({
    kind: 'preset',
    preset: 'currentBillingCycle',
  });
  const [timeZone, setTimeZone] = useState<BillingUsageTimeZone>('browser');
  return (
    <BillingUsageTimeRangeFilter
      value={range}
      bounds={bounds}
      timeZone={timeZone}
      onChange={setRange}
      onTimeZoneChange={setTimeZone}
    />
  );
}

async function openFilter(user: TestUserEvent, bounds = BOUNDS) {
  render(<FilterOnPage bounds={bounds} />);
  await user.click(
    screen.getByRole('button', { name: 'Current billing cycle · Oct 2026' }),
  );
}

function dayButton(day: string) {
  return screen.getByRole('button', { name: new RegExp(day) });
}

describe('BillingUsageTimeRangeFilter', () => {
  it('shows one day after picking it and applying', async () => {
    const user = new TestUserEvent();
    await openFilter(user);

    await user.click(dayButton('October 2nd, 2026'));
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(
      screen.getByRole('button', { name: 'Oct 2, 2026' }),
    ).toBeInTheDocument();
  });

  it('shows the days between two picked days', async () => {
    const user = new TestUserEvent();
    await openFilter(user);

    await user.click(dayButton('October 2nd, 2026'));
    await user.click(dayButton('October 4th, 2026'));
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(
      screen.getByRole('button', { name: 'Oct 2 – Oct 4, 2026' }),
    ).toBeInTheDocument();
  });

  it('orders the days when the later one is picked first', async () => {
    const user = new TestUserEvent();
    await openFilter(user);

    await user.click(dayButton('October 4th, 2026'));
    await user.click(dayButton('October 2nd, 2026'));
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(
      screen.getByRole('button', { name: 'Oct 2 – Oct 4, 2026' }),
    ).toBeInTheDocument();
  });

  it('disables the days after the latest report', async () => {
    const user = new TestUserEvent();
    await openFilter(user);

    expect(dayButton('October 6th, 2026')).toBeEnabled();
    expect(dayButton('October 7th, 2026')).toBeDisabled();
  });

  it('disables the days before the first report, and a previous billing cycle without reports', async () => {
    const user = new TestUserEvent();
    // An organization whose first report is from Oct 5.
    await openFilter(user, { ...BOUNDS, min: '2026-10-04T21:00:00.000Z' });

    expect(dayButton('October 4th, 2026')).toBeDisabled();
    expect(dayButton('October 5th, 2026')).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /^Previous billing cycle/ }),
    ).toBeDisabled();
  });

  it('switches the page to UTC', async () => {
    mockScrollIntoViewAndPointerCapture();
    const user = new TestUserEvent();
    await openFilter(user);

    await user.click(screen.getByRole('combobox', { name: 'Time zone' }));
    await user.click(screen.getByRole('option', { name: 'UTC' }));

    expect(
      screen.getByRole('button', {
        name: 'Current billing cycle · Oct 2026 (UTC)',
      }),
    ).toBeInTheDocument();
  });
});
