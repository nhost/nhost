const DAY_TICK_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
});

export default function formatBillingDayTick(timestamp: number): string {
  if (!Number.isFinite(timestamp)) {
    return '';
  }
  return DAY_TICK_FORMAT.format(new Date(timestamp));
}
