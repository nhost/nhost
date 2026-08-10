'use client';

import { TZDate } from '@date-fns/tz';
import { format, isValid, parseISO } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import { PopoverTrigger } from '@/components/ui/v3/popover';
import { cn } from '@/lib/utils';
import { guessTimezone } from '@/utils/timezoneUtils';

interface DateTimePickerTriggerProps {
  id?: string;
  dateTime: string | null;
  withTimezone: boolean;
  defaultTimezone?: string;
  formatDateFn?: (date: Date | string) => string;
  emptyLabel: string;
  hasError: boolean;
  testId: string;
  onClick: () => void;
}

export default function DateTimePickerTrigger({
  id,
  dateTime,
  withTimezone,
  defaultTimezone,
  formatDateFn,
  emptyLabel,
  hasError,
  testId,
  onClick,
}: DateTimePickerTriggerProps) {
  const parsed = dateTime ? parseISO(dateTime) : null;
  const date = parsed !== null && isValid(parsed) ? parsed : null;

  const displayDate =
    date && withTimezone
      ? new TZDate(date, defaultTimezone || guessTimezone())
      : date;

  const label = displayDate
    ? formatDateFn?.(displayDate) || format(displayDate, 'PPP HH:mm:ss')
    : emptyLabel;

  return (
    <PopoverTrigger asChild>
      <Button
        id={id}
        data-testid={testId}
        variant="outline"
        className={cn('w-full justify-between text-left font-normal', {
          'text-muted-foreground': date === null,
          'border-destructive': hasError,
        })}
        onClick={onClick}
      >
        {label}
        <CalendarIcon className="h-4 w-4" />
      </Button>
    </PopoverTrigger>
  );
}
