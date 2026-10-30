import { tz } from '@date-fns/tz';
import { format, parseISO, startOfMonth } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { Calendar } from '@/components/ui/v3/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { BILLING_USAGE_PRESET_LABELS } from '@/features/orgs/components/billing/BillingUsage/constants';
import {
  BILLING_USAGE_RANGE_PRESETS,
  type BillingUsageRangeBounds,
  type BillingUsageRangePreset,
  type BillingUsageTimeRange,
  type BillingUsageTimeZone,
  type ResolvedBillingUsageTimeRange,
} from '@/features/orgs/components/billing/BillingUsage/types';
import { getBillingUsagePresetCycle } from '@/features/orgs/components/billing/BillingUsage/utils/getBillingUsagePresetCycle';
import { getBillingUsagePresetCycleLabel } from '@/features/orgs/components/billing/BillingUsage/utils/getBillingUsagePresetCycleLabel';
import { getBillingUsageRangeDays } from '@/features/orgs/components/billing/BillingUsage/utils/getBillingUsageRangeDays';
import { getBillingUsageTimeZone } from '@/features/orgs/components/billing/BillingUsage/utils/getBillingUsageTimeZone';
import { isBillingUsageCalendarDayDisabled } from '@/features/orgs/components/billing/BillingUsage/utils/isBillingUsageCalendarDayDisabled';
import { resolveBillingUsageTimeRange } from '@/features/orgs/components/billing/BillingUsage/utils/resolveBillingUsageTimeRange';
import { validateBillingUsageTimeRange } from '@/features/orgs/components/billing/BillingUsage/utils/validateBillingUsageTimeRange';
import { cn } from '@/lib/utils';

export interface BillingUsageTimeRangeFilterProps {
  value: BillingUsageTimeRange;
  bounds: BillingUsageRangeBounds;
  timeZone: BillingUsageTimeZone;
  onChange: (next: BillingUsageTimeRange) => void;
  onTimeZoneChange: (next: BillingUsageTimeZone) => void;
}

export default function BillingUsageTimeRangeFilter({
  value,
  bounds,
  timeZone,
  onChange,
  onTimeZoneChange,
}: BillingUsageTimeRangeFilterProps) {
  const zone = getBillingUsageTimeZone(timeZone);
  const inZone = { in: tz(zone) };
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BillingUsageTimeRange>(value);
  // The day picked first, while the calendar waits for the other end.
  const firstPickedDayRef = useRef<string | null>(null);
  const resolvedDraft = resolveBillingUsageTimeRange(draft, bounds, zone);
  const resolvedValue = resolveBillingUsageTimeRange(value, bounds, zone);
  const draftDays = getBillingUsageRangeDays(
    resolvedDraft,
    zone,
    bounds.currentBillingCycle.end,
  );
  const [month, setMonth] = useState<Date>(() =>
    lastMonthOf(resolvedValue, bounds, zone),
  );
  const error = validateBillingUsageTimeRange(draft, bounds, zone);
  const activePreset = draft.kind === 'preset' ? draft.preset : null;
  const timeZoneHeadingId = useId();

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDraft(value);
      firstPickedDayRef.current = null;
      setMonth(lastMonthOf(resolvedValue, bounds, zone));
    }
    setOpen(nextOpen);
  }

  function handlePresetClick(preset: BillingUsageRangePreset) {
    const next: BillingUsageTimeRange = { kind: 'preset', preset };
    setDraft(next);
    firstPickedDayRef.current = null;
    setMonth(
      lastMonthOf(
        resolveBillingUsageTimeRange(next, bounds, zone),
        bounds,
        zone,
      ),
    );
  }

  function handleDayPick(day: Date) {
    const picked = format(day, 'yyyy-MM-dd', inZone);
    const firstPickedDay = firstPickedDayRef.current;
    if (firstPickedDay === null) {
      setDraft({ kind: 'absolute', from: picked, to: picked });
      firstPickedDayRef.current = picked;
      return;
    }
    setDraft(
      firstPickedDay <= picked
        ? { kind: 'absolute', from: firstPickedDay, to: picked }
        : { kind: 'absolute', from: picked, to: firstPickedDay },
    );
    firstPickedDayRef.current = null;
  }

  function handleApply() {
    onChange(draft);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="justify-start font-normal"
          data-testid="billingUsageTimeRangeTrigger"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span className="tabular-nums">
            {formatTriggerLabel(value, bounds, timeZone, zone)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[42rem] max-w-[calc(100vw-2rem)] p-0"
      >
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-col gap-1 border-b p-3 sm:min-w-[190px] sm:flex-1 sm:border-r sm:border-b-0">
            <span className="px-2 pb-1 font-medium text-muted-foreground text-xs">
              Quick ranges
            </span>
            {BILLING_USAGE_RANGE_PRESETS.map((preset) => {
              const cycleLabel = getBillingUsagePresetCycleLabel(
                preset,
                bounds,
                zone,
              );
              const active = activePreset === preset;
              return (
                <Button
                  key={preset}
                  variant={active ? 'outline' : 'ghost'}
                  size="sm"
                  className="group justify-between font-normal"
                  disabled={
                    getBillingUsagePresetCycle(preset, bounds)?.hasReports ===
                    false
                  }
                  onClick={() => handlePresetClick(preset)}
                >
                  {BILLING_USAGE_PRESET_LABELS[preset]}
                  {cycleLabel ? (
                    <span
                      className={cn(
                        'ml-3 text-xs',
                        !active &&
                          'text-muted-foreground group-hover:text-accent-foreground',
                      )}
                    >
                      {cycleLabel}
                    </span>
                  ) : null}
                </Button>
              );
            })}
          </div>
          <div className="flex w-full flex-col gap-3 p-3 sm:w-[340px]">
            <span className="px-1 font-medium text-muted-foreground text-xs">
              Days
            </span>
            <Calendar
              mode="range"
              fixedWeeks
              timeZone={zone}
              selected={{ from: draftDays.first, to: draftDays.last }}
              onSelect={(_range, day) => handleDayPick(day)}
              month={month}
              defaultMonth={month}
              onMonthChange={setMonth}
              startMonth={startOfMonth(bounds.min, inZone)}
              endMonth={startOfMonth(
                new Date(bounds.max).getTime() - 1,
                inZone,
              )}
              disabled={(date) =>
                isBillingUsageCalendarDayDisabled(date, bounds, zone)
              }
            />
            <div className="flex flex-col gap-1.5">
              <span
                id={timeZoneHeadingId}
                className="px-1 font-medium text-muted-foreground text-xs"
              >
                Time zone
              </span>
              <Select
                value={timeZone}
                onValueChange={(next) =>
                  onTimeZoneChange(next as BillingUsageTimeZone)
                }
              >
                <SelectTrigger aria-labelledby={timeZoneHeadingId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="browser">
                    Browser time ({getBillingUsageTimeZone('browser')})
                  </SelectItem>
                  <SelectItem value="utc">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error ? <p className="text-destructive text-xs">{error}</p> : null}
            <div className="mt-1 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleApply} disabled={Boolean(error)}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function lastMonthOf(
  range: ResolvedBillingUsageTimeRange,
  bounds: BillingUsageRangeBounds,
  zone: string,
) {
  const { last } = getBillingUsageRangeDays(
    range,
    zone,
    bounds.currentBillingCycle.end,
  );
  return startOfMonth(last, { in: tz(zone) });
}

function formatTriggerLabel(
  range: BillingUsageTimeRange,
  bounds: BillingUsageRangeBounds,
  timeZone: BillingUsageTimeZone,
  zone: string,
): string {
  const suffix = timeZone === 'utc' ? ' (UTC)' : '';
  if (range.kind === 'absolute') {
    return `${formatDays(range.from, range.to)}${suffix}`;
  }
  const label = BILLING_USAGE_PRESET_LABELS[range.preset];
  const cycleLabel = getBillingUsagePresetCycleLabel(
    range.preset,
    bounds,
    zone,
  );
  return cycleLabel ? `${label} · ${cycleLabel}${suffix}` : `${label}${suffix}`;
}

function formatDays(from: string, to: string): string {
  const first = parseISO(from);
  const last = parseISO(to);
  if (from === to) {
    return format(first, 'MMM d, yyyy');
  }
  if (first.getFullYear() === last.getFullYear()) {
    return `${format(first, 'MMM d')} – ${format(last, 'MMM d, yyyy')}`;
  }
  return `${format(first, 'MMM d, yyyy')} – ${format(last, 'MMM d, yyyy')}`;
}
