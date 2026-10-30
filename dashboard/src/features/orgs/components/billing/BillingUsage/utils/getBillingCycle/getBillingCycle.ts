import { tz } from '@date-fns/tz';
import { subMonths } from 'date-fns';

const UTC = { in: tz('UTC') };

export default function getBillingCycle(
  instant: number,
  currentBillingCycleEnd: string,
): { start: number; end: number } {
  const renewal = (monthsBeforeEnd: number) =>
    subMonths(currentBillingCycleEnd, monthsBeforeEnd, UTC).getTime();

  let months = 1;
  while (renewal(months) > instant) {
    months += 1;
  }
  while (renewal(months - 1) <= instant) {
    months -= 1;
  }

  return { start: renewal(months), end: renewal(months - 1) };
}
