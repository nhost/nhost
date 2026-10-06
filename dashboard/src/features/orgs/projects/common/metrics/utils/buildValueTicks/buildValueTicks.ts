const STEP_FACTORS = [1, 2, 2.5, 5, 10, 20, 25, 50];
const MIN_INTERVALS = 3;
const MAX_INTERVALS = 5;

// Evenly spaced round ticks from 0 up to the first tick at or above `max`.
// Of the round steps that split the axis into 3-5 intervals, the one with the
// lowest top wins (ties go to fewer ticks), so bars fill as much of the plot as
// possible.
export function buildValueTicks(max: number, allowDecimals = true): number[] {
  if (!Number.isFinite(max) || max <= 0) {
    return [0, 1];
  }

  const magnitude = 10 ** Math.floor(Math.log10(max / MAX_INTERVALS));
  let best: { step: number; intervals: number } | undefined;
  STEP_FACTORS.forEach((factor) => {
    const step = roundTick(factor * magnitude);
    if (!allowDecimals && !Number.isInteger(step)) {
      return;
    }
    const intervals = Math.ceil(roundTick(max / step));
    if (intervals < MIN_INTERVALS || intervals > MAX_INTERVALS) {
      return;
    }
    if (!best || intervals * step <= best.intervals * best.step) {
      best = { step, intervals };
    }
  });

  // Only integer ticks below 5 have no 3-5 interval split; count up by one.
  const { step, intervals } = best ?? { step: 1, intervals: Math.ceil(max) };
  return Array.from({ length: intervals + 1 }, (_, index) =>
    roundTick(index * step),
  );
}

function roundTick(value: number): number {
  return Number(value.toPrecision(12));
}
