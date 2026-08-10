const STEP_CANDIDATES_MS = [
  1_000,
  5_000,
  10_000,
  15_000,
  30_000,
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

export function computeTickStep(
  [fromMs, toMs]: [number, number],
  targetCount = 7,
): number {
  if (toMs <= fromMs || targetCount < 2) {
    return 0;
  }
  const rawStep = (toMs - fromMs) / (targetCount - 1);
  return (
    STEP_CANDIDATES_MS.find((c) => c >= rawStep) ??
    STEP_CANDIDATES_MS[STEP_CANDIDATES_MS.length - 1]
  );
}

export function buildTimeTicks(
  [fromMs, toMs]: [number, number],
  targetCount = 7,
): number[] {
  const step = computeTickStep([fromMs, toMs], targetCount);
  if (step === 0) {
    return [];
  }
  // Align ticks to local-time boundaries instead of UTC, so daily/hourly
  // ticks land on local 00:00, 06:00, etc. instead of UTC midnight.
  const tzOffsetMs = new Date(fromMs).getTimezoneOffset() * 60_000;
  const start = Math.ceil((fromMs - tzOffsetMs) / step) * step + tzOffsetMs;
  const ticks: number[] = [];
  for (let t = start; t <= toMs; t += step) {
    ticks.push(t);
  }
  return ticks;
}
