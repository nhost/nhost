const STEP_FACTORS = [1, 2, 2.5, 5, 10, 20, 25, 50];
const MIN_INTERVALS = 3;
const MAX_INTERVALS = 5;

// Evenly spaced whole-number ticks from 0 up to the first tick at or above
// `max`. Of the round steps that split the axis into 3-5 intervals, the one
// with the lowest top wins (ties go to fewer ticks), so bars fill as much of
// the plot as possible.
export default function buildValueTicks(max: number): number[] {
  if (max <= 0) {
    return [0, 1];
  }

  const magnitude = 10 ** Math.floor(Math.log10(max / MAX_INTERVALS));
  const steps = STEP_FACTORS.map((factor) => factor * magnitude).filter(
    Number.isInteger,
  );
  let best: { step: number; intervals: number } | undefined;
  steps.forEach((step) => {
    const intervals = Math.ceil(max / step);
    if (intervals < MIN_INTERVALS || intervals > MAX_INTERVALS) {
      return;
    }
    if (!best || intervals * step <= best.intervals * best.step) {
      best = { step, intervals };
    }
  });

  // With whole-number steps, an axis that only reaches 2 can't be split into 3
  // intervals, so count up by one.
  const axis = best ?? { step: 1, intervals: Math.ceil(max) };
  return Array.from(
    { length: axis.intervals + 1 },
    (_, index) => index * axis.step,
  );
}
