const STEP_CANDIDATES_MS = [
  60_000,
  2 * 60_000,
  5 * 60_000,
  10 * 60_000,
  15 * 60_000,
  30 * 60_000,
  60 * 60_000,
  2 * 60 * 60_000,
  3 * 60 * 60_000,
  6 * 60 * 60_000,
  12 * 60 * 60_000,
  24 * 60 * 60_000,
  2 * 24 * 60 * 60_000,
];

export function buildTimeTicks(
  [fromMs, toMs]: [number, number],
  targetCount = 7,
): number[] {
  if (toMs <= fromMs || targetCount < 2) {
    return [];
  }
  const rawStep = (toMs - fromMs) / (targetCount - 1);
  const step =
    STEP_CANDIDATES_MS.find((c) => c >= rawStep) ??
    STEP_CANDIDATES_MS[STEP_CANDIDATES_MS.length - 1];
  const start = Math.ceil(fromMs / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= toMs; t += step) {
    ticks.push(t);
  }
  return ticks;
}
