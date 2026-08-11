'use client';

import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { useState } from 'react';
import {
  type PickerTriggerSlot,
  usePickerTriggerSlot,
} from '@/components/common/PickerTriggerSlot';
import { TimePicker } from '@/components/common/TimePicker';
import { Button } from '@/components/ui/v3/button';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/v3/popover';
import isValidTime from './isValidTime';
import TimePickerTrigger from './TimePickerTrigger';

interface TimePickerFieldTriggerSlotProps {
  id?: string;
  time: string | null;
  emptyLabel: string;
  utc: boolean;
}

const UTC_TIME_ZONE = 'UTC';
const TIME_OFFSET_PATTERN = /[+-]\d{2}(:\d{2})?$/;

function getFractionalSeconds(time: string | null) {
  if (!isValidTime(time)) {
    return '';
  }

  const seconds = time.replace(TIME_OFFSET_PATTERN, '').split(':')[2];
  const fractionStart = seconds?.indexOf('.') ?? -1;

  return fractionStart === -1 ? '' : seconds.slice(fractionStart);
}

export interface TimePickerFieldProps {
  id?: string;
  time: string | null;
  onTimeChange: (newTime: string | null) => void;
  align?: 'start' | 'center' | 'end';
  /**
   * Label shown on the trigger when there is no value.
   *
   * @default 'Select a time'
   */
  emptyLabel?: string;
  /**
   * Whether to show a Clear button that emits `null`.
   *
   * @default false
   */
  clearable?: boolean;
  /**
   * Whether to render the trigger with a destructive border, e.g. when an
   * external form validation has failed.
   *
   * @default false
   */
  error?: boolean;
  /**
   * When true the picker edits in UTC: emitted values include a `+00`
   * suffix and the trigger shows a "UTC" indicator.
   *
   * @default false
   */
  utc?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerSlot?: PickerTriggerSlot<TimePickerFieldTriggerSlotProps>;
}

function TimePickerField({
  id,
  time,
  onTimeChange,
  align = 'start',
  emptyLabel = 'Select a time',
  clearable = false,
  error = false,
  utc = false,
  open: controlledOpen,
  onOpenChange,
  triggerSlot,
}: TimePickerFieldProps) {
  const isEmpty = !isValidTime(time);

  function resolveDate() {
    const base = utc ? new TZDate(new Date(), UTC_TIME_ZONE) : new Date();

    if (isEmpty) {
      return base;
    }

    const stripped = time.replace(TIME_OFFSET_PATTERN, '');
    const [hours, minutes, seconds] = stripped.split(':').map(Number);
    base.setHours(hours, minutes, Math.trunc(seconds ?? 0), 0);

    return base;
  }

  const [date, setDate] = useState(resolveDate);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;

  function setPickerOpen(newOpenState: boolean) {
    if (controlledOpen === undefined) {
      setInternalOpen(newOpenState);
    }

    onOpenChange?.(newOpenState);
  }

  function handleOpenChange(newOpenState: boolean) {
    setDate(resolveDate());
    setPickerOpen(newOpenState);
  }

  function onSelect() {
    const formatted = `${format(date, 'HH:mm:ss')}${getFractionalSeconds(time)}`;
    onTimeChange(utc ? `${formatted}+00` : formatted);
    setPickerOpen(false);
  }

  function onClear() {
    onTimeChange(null);
    setPickerOpen(false);
  }

  const { triggerSlotProps, contentProps } = usePickerTriggerSlot({
    open,
    setOpen: handleOpenChange,
    hasError: error,
  });

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      {triggerSlot ? (
        <PopoverAnchor asChild>
          {triggerSlot({
            ...triggerSlotProps,
            id,
            time,
            emptyLabel,
            utc,
          })}
        </PopoverAnchor>
      ) : (
        <TimePickerTrigger
          id={id}
          time={time}
          emptyLabel={emptyLabel}
          hasError={error}
          utc={utc}
          onClick={() => setPickerOpen(true)}
        />
      )}

      <PopoverContent
        {...(triggerSlot ? contentProps : {})}
        className="w-auto p-0"
        align={align}
      >
        <div className="p-3">
          <TimePicker date={date} setDate={setDate} />
        </div>
        <div className="flex flex-row gap-2 border-border border-t p-3">
          {clearable && (
            <Button variant="outline" className="w-full" onClick={onClear}>
              Clear
            </Button>
          )}
          <Button className="w-full" onClick={onSelect}>
            Select
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default TimePickerField;
