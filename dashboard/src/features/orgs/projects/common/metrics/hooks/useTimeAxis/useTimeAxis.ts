import { useMemo } from 'react';
import {
  buildTimeTicks,
  computeTickStep,
} from '@/features/orgs/projects/common/metrics/utils/buildTimeTicks';
import {
  formatTimestampDateTick,
  formatTimestampSecondsTick,
  formatTimestampTick,
} from '@/features/orgs/projects/common/metrics/utils/formatters';

const DAY_MS = 24 * 60 * 60_000;

interface TimeAxis {
  // XAxis tick positions, or undefined when there is no explicit domain (Recharts
  // then auto-derives them).
  ticks: number[] | undefined;
  tickFormatter: (ts: unknown) => string;
}

function selectTickFormatter(
  xDomain: [number, number] | undefined,
): (ts: unknown) => string {
  if (!xDomain) {
    return formatTimestampTick;
  }
  if (xDomain[1] - xDomain[0] > DAY_MS) {
    return formatTimestampDateTick;
  }
  return computeTickStep(xDomain) < 60_000
    ? formatTimestampSecondsTick
    : formatTimestampTick;
}

export default function useTimeAxis(
  xDomain: [number, number] | undefined,
): TimeAxis {
  const ticks = useMemo(
    () => (xDomain ? buildTimeTicks(xDomain) : undefined),
    [xDomain],
  );

  const tickFormatter = selectTickFormatter(xDomain);

  return { ticks, tickFormatter };
}
