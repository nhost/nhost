import { format, parseISO } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import { DateTimePicker } from '@/components/common/DateTimePicker';
import { Button } from '@/components/ui/v3/button';
import { Label } from '@/components/ui/v3/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import {
  BILLING_USAGE_PRESET_LABELS,
  BILLING_USAGE_RANGE_PRESETS,
  type BillingUsageRangeBounds,
  type BillingUsageRangePreset,
  type BillingUsageTimeRange,
  isBillingUsageCalendarDayDisabled,
  resolveBillingUsageTimeRange,
  validateBillingUsageTimeRange,
} from '@/features/orgs/components/billing/BillingMetricsPreview/utils/billingUsageTimeRange';

const TRIGGER_FORMAT = 'MMM d, HH:mm';

export interface BillingUsageTimeRangeFilterProps {
  value: BillingUsageTimeRange;
  bounds: BillingUsageRangeBounds;
  onChange: (next: BillingUsageTimeRange) => void;
}

export default function BillingUsageTimeRangeFilter({
  value,
  bounds,
  onChange,
}: BillingUsageTimeRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BillingUsageTimeRange>(value);
  const resolvedDraft = resolveBillingUsageTimeRange(draft, bounds);
  const resolvedValue = resolveBillingUsageTimeRange(value, bounds);
  const error = validateBillingUsageTimeRange(draft, bounds);
  const activePreset = draft.kind === 'preset' ? draft.preset : null;

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDraft(value);
    }
    setOpen(nextOpen);
  }

  function handlePresetClick(preset: BillingUsageRangePreset) {
    setDraft({ kind: 'preset', preset });
  }

  function handleFromChange(newIso: string | null) {
    if (newIso !== null) {
      setDraft({
        kind: 'absolute',
        from: newIso,
        to: resolvedDraft.to.toISOString(),
      });
    }
  }

  function handleToChange(newIso: string | null) {
    if (newIso !== null) {
      setDraft({
        kind: 'absolute',
        from: resolvedDraft.from.toISOString(),
        to: newIso,
      });
    }
  }

  function validatePickerDate(date: Date): string {
    if (date.getTime() < new Date(bounds.min).getTime()) {
      return 'Usage reports are retained for at most 60 days.';
    }
    if (date.getTime() > new Date(bounds.max).getTime()) {
      return 'Future times are not available.';
    }
    return '';
  }

  function handleApply() {
    if (error) {
      return;
    }
    onChange(draft);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="justify-start gap-2 font-normal"
              data-testid="billingUsageTimeRangeTrigger"
            >
              <CalendarIcon className="h-4 w-4" />
              <span className="tabular-nums">{formatTriggerLabel(value)}</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent className="text-center">
          {resolvedValue.from.toISOString()}
          <br />
          to
          <br />
          {resolvedValue.to.toISOString()}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        className="w-[34rem] max-w-[calc(100vw-2rem)] p-0"
      >
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-col gap-1 border-b p-3 sm:min-w-[190px] sm:border-r sm:border-b-0">
            <span className="px-2 pb-1 font-medium text-muted-foreground text-xs">
              Quick ranges
            </span>
            {BILLING_USAGE_RANGE_PRESETS.map((preset) => (
              <Button
                key={preset}
                variant={activePreset === preset ? 'secondary' : 'ghost'}
                size="sm"
                className="justify-start font-normal"
                onClick={() => handlePresetClick(preset)}
              >
                {BILLING_USAGE_PRESET_LABELS[preset]}
              </Button>
            ))}
          </div>
          <div className="flex w-full flex-col gap-3 p-3 sm:w-[340px]">
            <span className="px-1 pb-1 font-medium text-muted-foreground text-xs">
              Absolute time range
            </span>
            <div className="flex flex-col gap-1.5">
              <Label className="text-muted-foreground text-xs">From</Label>
              <DateTimePicker
                key={resolvedDraft.from.toISOString()}
                dateTime={resolvedDraft.from.toISOString()}
                triggerTestId="billingUsageFromPickerTrigger"
                onDateTimeChange={handleFromChange}
                isCalendarDayDisabled={(date) =>
                  isBillingUsageCalendarDayDisabled(date, bounds)
                }
                validateDateFn={validatePickerDate}
                withTimezone
                align="end"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-muted-foreground text-xs">To</Label>
              <DateTimePicker
                key={resolvedDraft.to.toISOString()}
                dateTime={resolvedDraft.to.toISOString()}
                triggerTestId="billingUsageToPickerTrigger"
                onDateTimeChange={handleToChange}
                isCalendarDayDisabled={(date) =>
                  isBillingUsageCalendarDayDisabled(date, bounds)
                }
                validateDateFn={validatePickerDate}
                withTimezone
                align="end"
              />
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

function formatTriggerLabel(range: BillingUsageTimeRange): string {
  if (range.kind === 'preset') {
    return BILLING_USAGE_PRESET_LABELS[range.preset];
  }
  return `${format(parseISO(range.from), TRIGGER_FORMAT)} → ${format(
    parseISO(range.to),
    TRIGGER_FORMAT,
  )}`;
}
