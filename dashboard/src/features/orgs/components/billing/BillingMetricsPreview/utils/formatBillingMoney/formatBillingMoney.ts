const MINOR_UNITS_PER_MAJOR = 100;

export function formatBillingMoney(
  amountMinor: number,
  currency: string,
): string {
  if (!Number.isFinite(amountMinor)) {
    return '—';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / MINOR_UNITS_PER_MAJOR);
}
