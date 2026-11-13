import type { Row } from '@/features/orgs/projects/common/metrics/utils/seriesGeometry';

export default function padRowsToTimeDomain(
  rows: Row[],
  keys: string[],
  timeDomain: [number, number] | undefined,
): Row[] {
  if (!timeDomain || rows.length < 2) {
    return rows;
  }

  const step = medianStep(rows);
  const emptyRow = (timestamp: number): Row => {
    const row: Row = { timestamp };
    keys.forEach((key) => {
      row[key] = null;
    });
    return row;
  };

  const before: Row[] = [];
  for (
    let timestamp = rows[0].timestamp - step;
    timestamp > timeDomain[0];
    timestamp -= step
  ) {
    before.unshift(emptyRow(timestamp));
  }

  const after: Row[] = [];
  for (
    let timestamp = rows[rows.length - 1].timestamp + step;
    timestamp < timeDomain[1];
    timestamp += step
  ) {
    after.push(emptyRow(timestamp));
  }

  return [...before, ...rows, ...after];
}

function medianStep(rows: Row[]): number {
  const steps = rows
    .slice(1)
    .map((row, index) => row.timestamp - rows[index].timestamp)
    .sort((a, b) => a - b);
  return steps[Math.floor(steps.length / 2)];
}
