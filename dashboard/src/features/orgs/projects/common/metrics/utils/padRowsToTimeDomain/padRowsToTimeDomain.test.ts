import { padRowsToTimeDomain } from '@/features/orgs/projects/common/metrics/utils/padRowsToTimeDomain';

const rows = [
  { timestamp: 30, a: 1 },
  { timestamp: 40, a: 2 },
  { timestamp: 50, a: 3 },
];

describe('padRowsToTimeDomain', () => {
  it('fills the rest of the time domain with empty rows one step apart', () => {
    expect(padRowsToTimeDomain(rows, ['a'], [15, 75])).toEqual([
      { timestamp: 20, a: null },
      ...rows,
      { timestamp: 60, a: null },
      { timestamp: 70, a: null },
    ]);
  });

  it('keeps the rows as they are without a time domain', () => {
    expect(padRowsToTimeDomain(rows, ['a'], undefined)).toBe(rows);
  });
});
