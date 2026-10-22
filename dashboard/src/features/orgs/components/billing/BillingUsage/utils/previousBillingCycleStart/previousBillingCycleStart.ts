export default function previousBillingCycleStart(
  currentBillingCycleStart: string,
): number {
  const cycleStart = new Date(currentBillingCycleStart);
  return Date.UTC(cycleStart.getUTCFullYear(), cycleStart.getUTCMonth() - 1, 1);
}
