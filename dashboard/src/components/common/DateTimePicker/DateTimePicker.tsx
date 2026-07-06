'use client';

import { TZDate } from '@date-fns/tz';
import { add, isValid, parseISO } from 'date-fns';
import { useState } from 'react';
import {
  type PickerTriggerSlot,
  usePickerTriggerSlot,
} from '@/components/common/PickerTriggerSlot';
import { TimePicker } from '@/components/common/TimePicker';
import { Button } from '@/components/ui/v3/button';
import { Calendar } from '@/components/ui/v3/calendar';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/v3/popover';
import { cn } from '@/lib/utils';
import { guessTimezone } from '@/utils/timezoneUtils';
import DateTimePickerTrigger from './DateTimePickerTrigger';
import TimezoneSettings from './TimezoneSettings';

interface DateTimePickerTriggerSlotProps {
  id?: string;
  dateTime: string | null;
  withTimezone: boolean;
  defaultTimezone?: string;
  formatDateFn?: (date: Date | string) => string;
  emptyLabel: string;
  testId: string;
}

export interface DateTimePickerProps {
  id?: string;
  dateTime: string | null;
  onDateTimeChange: (newDate: string | null) => void;
  withTimezone?: boolean;
  defaultTimezone?: string;
  formatDateFn?: (date: Date | string) => string;
  isCalendarDayDisabled?: (date: Date) => boolean;
  align?: 'start' | 'center' | 'end';
  validateDateFn?: (date: Date) => string;
  triggerTestId?: string;
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
  triggerSlot?: PickerTriggerSlot<DateTimePickerTriggerSlotProps>;
}

function DateTimePicker({
  id,
  dateTime,
  withTimezone = false,
  defaultTimezone,
  formatDateFn,
  onDateTimeChange,
  isCalendarDayDisabled,
  align = 'start',
  validateDateFn,
  triggerTestId = 'dateTimePickerTrigger',
  emptyLabel = 'Select a date',
  clearable = false,
  error = false,
  open: controlledOpen,
  onOpenChange,
  triggerSlot,
}: DateTimePickerProps) {
  const isEmpty = !dateTime || !isValid(parseISO(dateTime));

  function resolveDate() {
    const tz = defaultTimezone || guessTimezone();
    const value = isEmpty ? new Date() : parseISO(dateTime);

    return withTimezone ? new TZDate(value, tz) : value;
  }

  const [date, setDate] = useState(resolveDate);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;

  const [timezone, setTimezone] = useState(
    () => defaultTimezone || guessTimezone(),
  );

  function emitNewDateTime() {
    onDateTimeChange(new Date(date.getTime()).toISOString());
  }

  /**
   * carry over the current time when a user clicks a new day
   * instead of resetting to 00:00
   */
  function handleSelect(newDay: Date | undefined) {
    if (!newDay) {
      return;
    }
    if (!date) {
      setDate(newDay);
      return;
    }
    const diff = newDay.getTime() - date.getTime();
    const diffInDays = diff / (1000 * 60 * 60 * 24);
    const newDateFull = add(date, { days: Math.ceil(diffInDays) });
    setDate(newDateFull);
  }

  function handleTimezoneChange(newTimezone: string) {
    const newDateWithTimezone = new TZDate(date.toISOString(), newTimezone);
    setTimezone(newTimezone);
    setDate(newDateWithTimezone);
  }

  function setPickerOpen(newOpenState: boolean) {
    if (controlledOpen === undefined) {
      setInternalOpen(newOpenState);
    }

    onOpenChange?.(newOpenState);
  }

  function handleOpenChange(newOpenState: boolean) {
    if (withTimezone) {
      setTimezone(defaultTimezone || guessTimezone());
    }
    setDate(resolveDate());
    setPickerOpen(newOpenState);
  }

  function onSelect() {
    emitNewDateTime();
    setPickerOpen(false);
  }

  function onClear() {
    onDateTimeChange(null);
    setPickerOpen(false);
  }

  const selectedDateInUTC = new Date(date.getTime()).toISOString();

  const errorText = !isEmpty ? validateDateFn?.(date) : undefined;
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
            dateTime,
            withTimezone,
            defaultTimezone,
            formatDateFn,
            emptyLabel,
            testId: triggerTestId,
          })}
        </PopoverAnchor>
      ) : (
        <DateTimePickerTrigger
          id={id}
          dateTime={dateTime}
          withTimezone={withTimezone}
          defaultTimezone={defaultTimezone}
          formatDateFn={formatDateFn}
          emptyLabel={emptyLabel}
          hasError={triggerHasError}
          testId={triggerTestId}
          onClick={() => setPickerOpen(true)}
        />
      )}

      <PopoverContent
        {...(triggerSlot ? contentProps : {})}
        className="w-auto p-0"
        align={align}
      >
        <div className="flex">
          <div className="flex">
            <Calendar
              mode="single"
              selected={date}
              defaultMonth={date}
              onSelect={(d) => handleSelect(d)}
              disabled={isCalendarDayDisabled}
              timeZone={timezone}
            />
            <div className="flex flex-col justify-between">
              <div>
                <div className="border-border border-t p-3">
                  <TimePicker setDate={setDate} date={date} />
                </div>
                {withTimezone && (
                  <div className="border-border border-t p-3">
                    <TimezoneSettings
                      dateTime={selectedDateInUTC}
                      timezone={timezone}
                      onTimezoneChange={handleTimezoneChange}
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-row justify-between gap-5 p-3">
                {clearable && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={onClear}
                  >
                    Clear
                  </Button>
                )}
                <Button
                  className="w-full"
                  onClick={onSelect}
                  disabled={hasError}
                >
                  Select
                </Button>
              </div>
            </div>
          </div>
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

export default DateTimePicker;
