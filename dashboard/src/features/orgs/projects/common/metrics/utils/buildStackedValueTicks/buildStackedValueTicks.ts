import { buildValueTicks } from '@/features/orgs/projects/common/metrics/utils/buildValueTicks';
import type { Row } from '@/features/orgs/projects/common/metrics/utils/seriesGeometry';

// Keeps the tallest bar clear of the top edge of the plot.
const Y_AXIS_HEADROOM = 1.1;

// The axis only grows to show a reference line once the tallest bar reaches
// half of it; with less, the bars would be squashed at the bottom.
const REFERENCE_LINE_AXIS_THRESHOLD = 0.5;

export interface BuildStackedValueTicksOptions {
  rows: Row[];
  keys: string[];
  hiddenSet: Set<string>;
  referenceLines?: ReadonlyArray<{ value: number }>;
}

function visibleStackTotal(row: Row, keys: string[], hiddenSet: Set<string>) {
  return keys.reduce(
    (sum, key) => (hiddenSet.has(key) ? sum : sum + (row[key] ?? 0)),
    0,
  );
}

// Value axis ticks from 0 to just above the tallest stack of visible series,
// stretched to the reference lines the data comes close to.
export default function buildStackedValueTicks({
  rows,
  keys,
  hiddenSet,
  referenceLines = [],
}: BuildStackedValueTicksOptions): number[] {
  const tallestBar = Math.max(
    0,
    ...rows.map((row) => visibleStackTotal(row, keys, hiddenSet)),
  );
  const reachedReferenceValues = referenceLines
    .filter(
      (referenceLine) =>
        tallestBar >= referenceLine.value * REFERENCE_LINE_AXIS_THRESHOLD,
    )
    .map((referenceLine) => referenceLine.value);
  return buildValueTicks(
    Math.max(tallestBar, ...reachedReferenceValues) * Y_AXIS_HEADROOM,
  );
}
