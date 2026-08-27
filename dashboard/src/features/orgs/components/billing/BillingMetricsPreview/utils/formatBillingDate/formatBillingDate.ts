const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const DAY_TICK_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
});

const MONTH_TICK_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
});

const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
});

export function formatBillingDayTick(timestamp: number): string {
  return formatTimestampWith(timestamp, DAY_TICK_FORMAT);
}

export function formatBillingDayLabel(timestamp: number): string {
  return formatTimestampWith(timestamp, DATE_FORMAT);
}

export function formatBillingMonthTick(timestamp: number): string {
  return formatTimestampWith(timestamp, MONTH_TICK_FORMAT);
}

export function formatBillingMonthLabel(timestamp: number): string {
  return formatTimestampWith(timestamp, MONTH_LABEL_FORMAT);
}

function formatTimestampWith(
  timestamp: number,
  formatter: Intl.DateTimeFormat,
): string {
  if (!Number.isFinite(timestamp)) {
    return '';
  }
  return formatter.format(new Date(timestamp));
}
