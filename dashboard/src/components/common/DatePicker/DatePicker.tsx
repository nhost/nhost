'use client';

import { isValid, parseISO } from 'date-fns';
import { useState } from 'react';
import {
  type PickerTriggerSlot,
  usePickerTriggerSlot,
} from '@/components/common/PickerTriggerSlot';
import { Button } from '@/components/ui/v3/button';
import { Calendar } from '@/components/ui/v3/calendar';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/v3/popover';
import { cn } from '@/lib/utils';
import DatePickerTrigger from './DatePickerTrigger';

interface DatePickerTriggerSlotProps {
  id?: string;
  date: string | null;
  formatDateFn?: (date: Date) => string;
  emptyLabel: string;
}

export interface DatePickerProps {
  id?: string;
  date: string | null;
  onDateChange: (newDate: string | null) => void;
  formatDateFn?: (date: Date) => string;
  isCalendarDayDisabled?: (date: Date) => boolean;
  align?: 'start' | 'center' | 'end';
  validateDateFn?: (date: Date) => string;
  /**
   * Label shown on the trigger when there is no value.
   *
   * @default 'Select a date'
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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerSlot?: PickerTriggerSlot<DatePickerTriggerSlotProps>;
}

function DatePicker({
  id,
  date,
  onDateChange,
  formatDateFn,
  isCalendarDayDisabled,
  align = 'start',
  validateDateFn,
  emptyLabel = 'Select a date',
  clearable = false,
  error = false,
  open: controlledOpen,
  onOpenChange,
  triggerSlot,
}: DatePickerProps) {
  const isEmpty = !date || !isValid(parseISO(date));

  function resolveDate() {
    return isEmpty ? new Date() : parseISO(date);
  }

  const [selected, setSelected] = useState(resolveDate);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;

  function handleSelect(newDay: Date | undefined) {
    if (newDay) {
      setSelected(newDay);
    }
  }

  function setPickerOpen(newOpenState: boolean) {
    if (controlledOpen === undefined) {
      setInternalOpen(newOpenState);
    }

    onOpenChange?.(newOpenState);
  }

  function handleOpenChange(newOpenState: boolean) {
    setSelected(resolveDate());
    setPickerOpen(newOpenState);
  }

  function onSelect() {
    onDateChange(selected.toISOString());
    setPickerOpen(false);
  }

  function onClear() {
    onDateChange(null);
    setPickerOpen(false);
  }

  const errorText = !isEmpty ? validateDateFn?.(selected) : undefined;
  const hasError = !!errorText;
  const triggerHasError = hasError || error;
  const { triggerSlotProps, contentProps } = usePickerTriggerSlot({
    open,
    setOpen: handleOpenChange,
    hasError: triggerHasError,
  });

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      {triggerSlot ? (
        <PopoverAnchor asChild>
          {triggerSlot({
            ...triggerSlotProps,
            id,
            date,
            formatDateFn,
            emptyLabel,
          })}
        </PopoverAnchor>
      ) : (
        <DatePickerTrigger
          id={id}
          date={date}
          formatDateFn={formatDateFn}
          emptyLabel={emptyLabel}
          hasError={triggerHasError}
          onClick={() => setPickerOpen(true)}
        />
      )}

      <PopoverContent
        {...(triggerSlot ? contentProps : {})}
        className="w-auto p-0"
        align={align}
      >
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={handleSelect}
          disabled={isCalendarDayDisabled}
        />
        <div className="flex flex-row gap-2 border-border border-t p-3">
          {clearable && (
            <Button variant="outline" className="w-full" onClick={onClear}>
              Clear
            </Button>
          )}
          <Button className="w-full" onClick={onSelect} disabled={hasError}>
            Select
          </Button>
        </div>
        {validateDateFn && (
          <div
            className={cn('p-3 text-center text-[11px] text-destructive', {
              invisible: !hasError,
            })}
          >
            {errorText}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default DatePicker;
