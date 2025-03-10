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

interface Props {
  dateTime: string;
  onDateTimeChange: (newDate: string) => void;
  withTimezone?: boolean;
  defaultTimezone?: string;
  formatDateFn?: (date: Date) => string;
  isCalendarDayDisabled?: (date: Date) => boolean;
}
// in: UTC datetime
// out: UTC dateTime

function DateTimePicker({
  dateTime,
  withTimezone = false,
  defaultTimezone,
  formatDateFn,
  onDateTimeChange,
  isCalendarDayDisabled,
}: Props) {
  const [date, setDate] = useState(() => {
    if (withTimezone) {
      const tz = defaultTimezone || guessTimezone();
      return new TZDate(dateTime, tz);
    }
    return parseISO(dateTime);
  });

  function emitNewDateTime(newDate: Date) {
    onDateTimeChange(new Date(newDate.getTime()).toISOString());
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
    emitNewDateTime(newDateFull);
  }

  function handleTimeChange(newDate: Date) {
    setDate(newDate);
    emitNewDateTime(newDate);
  }

  function handleTimezoneChange(newTimezone: string) {
    const newDateWithTimezone = new TZDate(date.toISOString(), newTimezone);
    setDate(newDateWithTimezone);
  }

  const dateString = formatDateFn?.(date) || format(date, 'PPP HH:mm:ss');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-between text-left font-normal',
            !date && 'text-muted-foreground',
          )}
        >
          {date ? dateString : <span>Pick a date</span>}
          <CalendarIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => handleSelect(d)}
          initialFocus
          disabled={isCalendarDayDisabled}
        />
        <div className="border-t border-border p-3">
          <TimePicker setDate={handleTimeChange} date={date} />
        </div>
        {withTimezone && (
          <div className="border-t border-border p-3">
            <TimezoneSettings
              dateTime={dateTime}
              onTimezoneChange={handleTimezoneChange}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default DateTimePicker;
