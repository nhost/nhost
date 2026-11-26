import { buildStackedValueTicks } from '@/features/orgs/projects/common/metrics/utils/buildStackedValueTicks';

const rows = [
  { timestamp: 1, a: 10, b: 20 },
  { timestamp: 2, a: 30, b: 50 },
  { timestamp: 3, a: null, b: 5 },
];
const keys = ['a', 'b'];

describe('buildStackedValueTicks', () => {
  it('fits the tallest stack with headroom', () => {
    expect(
      buildStackedValueTicks({
        rows,
        keys,
        hiddenSet: new Set(),
      }),
    ).toEqual([0, 25, 50, 75, 100]);
  });

  it('leaves hidden series out of the stack', () => {
    expect(
      buildStackedValueTicks({
        rows,
        keys,
        hiddenSet: new Set(['b']),
      }),
    ).toEqual([0, 10, 20, 30, 40]);
  });

  it('stretches to a reference line the data reaches half of', () => {
    expect(
      buildStackedValueTicks({
        rows,
        keys,
        hiddenSet: new Set(['b']),
        referenceLines: [{ value: 50 }],
      }),
    ).toEqual([0, 20, 40, 60]);
  });

  it('ignores a reference line far above the data', () => {
    expect(
      buildStackedValueTicks({
        rows,
        keys,
        hiddenSet: new Set(['b']),
        referenceLines: [{ value: 100 }],
      }),
    ).toEqual([0, 10, 20, 30, 40]);
  });

  it.each([
    [2, [0, 1, 2, 3]],
    [1, [0, 1, 2]],
    [0.2, [0, 1]],
  ])(
    'counts up by whole numbers when the tallest bar is %s',
    (value, ticks) => {
      expect(
        buildStackedValueTicks({
          rows: [{ timestamp: 1, a: value }],
          keys: ['a'],
          hiddenSet: new Set(),
        }),
      ).toEqual(ticks);
    },
  );

  it('falls back to a unit axis without data', () => {
    expect(
      buildStackedValueTicks({
        rows: [],
        keys,
        hiddenSet: new Set(),
      }),
    ).toEqual([0, 1]);
  });
});
