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
  METRICS_RANGE_PRESETS,
  type MetricsRangePreset,
  type MetricsTimeRange,
  PRESET_LABELS,
  resolveTimeRange,
} from '@/features/orgs/projects/common/metrics/utils/timeRange';

const TRIGGER_FORMAT = 'MMM d, HH:mm:ss';

function formatTriggerLabel(range: MetricsTimeRange): string {
  if (range.kind === 'preset') {
    return PRESET_LABELS[range.preset];
  }
  return `${format(parseISO(range.from), TRIGGER_FORMAT)} → ${format(
    parseISO(range.to),
    TRIGGER_FORMAT,
  )}`;
}

export interface MetricsTimeRangeFilterProps {
  value: MetricsTimeRange;
  onChange: (next: MetricsTimeRange) => void;
}

export default function MetricsTimeRangeFilter({
  value,
  onChange,
}: MetricsTimeRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MetricsTimeRange>(value);

  const resolved = resolveTimeRange(draft);
  const resolvedValue = resolveTimeRange(value);
  const activePreset = draft.kind === 'preset' ? draft.preset : null;
  const isInvalid = resolved.from.getTime() >= resolved.to.getTime();

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDraft(value);
    }
    setOpen(nextOpen);
  }

  function handlePresetClick(preset: MetricsRangePreset) {
    setDraft({ kind: 'preset', preset });
  }

  function handleFromChange(newIso: string) {
    setDraft({
      kind: 'absolute',
      from: newIso,
      to: resolved.to.toISOString(),
    });
  }

  function handleToChange(newIso: string) {
    setDraft({
      kind: 'absolute',
      from: resolved.from.toISOString(),
      to: newIso,
    });
  }

  function handleApply() {
    onChange(draft);
    setOpen(false);
  }

  function handleCancel() {
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
              data-testid="metricsTimeRangeTrigger"
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
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex">
          <div className="flex min-w-[180px] flex-col gap-1 border-r p-3">
            <span className="px-2 pb-1 font-medium text-muted-foreground text-xs">
              Quick ranges
            </span>
            {METRICS_RANGE_PRESETS.map((preset) => (
              <Button
                key={preset}
                variant={activePreset === preset ? 'secondary' : 'ghost'}
                size="sm"
                className="justify-start font-normal"
                onClick={() => handlePresetClick(preset)}
              >
                {PRESET_LABELS[preset]}
              </Button>
            ))}
          </div>
          <div className="flex w-[340px] flex-col gap-3 p-3">
            <span className="px-1 pb-1 font-medium text-muted-foreground text-xs">
              Absolute time range
            </span>
            {/*
              DateTimePicker seeds its internal date from `dateTime` once
              (uncontrolled). Keying it on the resolved value remounts it when a
              preset/Apply changes the range, so the From/To fields reflect the
              new range — without making the shared component prop-controlled.
            */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-muted-foreground text-xs">From</Label>
              <DateTimePicker
                key={resolved.from.toISOString()}
                dateTime={resolved.from.toISOString()}
                onDateTimeChange={handleFromChange}
                withTimezone
                align="end"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-muted-foreground text-xs">To</Label>
              <DateTimePicker
                key={resolved.to.toISOString()}
                dateTime={resolved.to.toISOString()}
                onDateTimeChange={handleToChange}
                withTimezone
                align="end"
              />
            </div>
            {isInvalid && (
              <p className="text-destructive text-xs">
                &quot;From&quot; must be earlier than &quot;To&quot;.
              </p>
            )}
            <div className="mt-1 flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleApply} disabled={isInvalid}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
