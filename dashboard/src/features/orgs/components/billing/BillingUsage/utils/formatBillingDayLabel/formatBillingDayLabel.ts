const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export default function formatBillingDayLabel(timestamp: number): string {
  if (!Number.isFinite(timestamp)) {
    return '';
  }
  return DATE_FORMAT.format(new Date(timestamp));
}
