'use client';

import { TimePicker } from '@/components/common/TimePicker';

import { Button } from '@/components/ui/v3/button';
import { Calendar } from '@/components/ui/v3/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { cn } from '@/lib/utils';
import { guessTimezone } from '@/utils/timezoneUtils';
import { TZDate } from '@date-fns/tz';
import { add, format, parseISO } from 'date-fns-v4';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import TimezoneSettings from './TimezoneSettings';

export interface DateTimePickerProps {
  dateTime: string;
  onDateTimeChange: (newDate: string) => void;
  withTimezone?: boolean;
  defaultTimezone?: string;
  formatDateFn?: (date: Date | string) => string;
  isCalendarDayDisabled?: (date: Date) => boolean;
  align?: 'start' | 'center' | 'end';
  validateDateFn?: (date: Date) => string;
}

function DateTimePicker({
  dateTime,
  withTimezone = false,
  defaultTimezone,
  formatDateFn,
  onDateTimeChange,
  isCalendarDayDisabled,
  align = 'start',
  validateDateFn,
}: DateTimePickerProps) {
  const [date, setDate] = useState(() => {
    if (withTimezone) {
      const tz = defaultTimezone || guessTimezone();
      return new TZDate(dateTime, tz);
    }
    return parseISO(dateTime);
  });
  const [open, setOpen] = useState(false);

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

  function handleOpenChange(newOpenState: boolean) {
    if (!newOpenState) {
      if (withTimezone) {
        const tz = defaultTimezone || guessTimezone();
        setTimezone(tz);
        setDate(new TZDate(dateTime, tz));
      }
      setDate(parseISO(dateTime));
    }
    setOpen(newOpenState);
  }

  function onSelect() {
    emitNewDateTime();
    setOpen(false);
  }

  const selectedDateInUTC = new Date(date.getTime()).toISOString();

  const dateString = formatDateFn?.(date) || format(date, 'PPP HH:mm:ss');

  const errorText = validateDateFn?.(date);
  const hasError = !!errorText;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          data-testid="dateTimePickerTrigger"
          variant="outline"
          className={cn(
            'w-full justify-between text-left font-normal',
            !date && 'text-muted-foreground',
            { 'border-destructive': hasError },
          )}
          onClick={() => setOpen(true)}
        >
          {date ? dateString : <span>Pick a date</span>}
          <CalendarIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align={align}>
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
                      onTimezoneChange={handleTimezoneChange}
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-row justify-between gap-5 p-3">
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
        <div
          className={cn('p-3 text-center text-[11px] text-destructive', {
            invisible: !hasError,
          })}
        >
          {errorText}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DateTimePicker;
