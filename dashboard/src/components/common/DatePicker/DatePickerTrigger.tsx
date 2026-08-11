'use client';

import { format, isValid, parseISO } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import { PopoverTrigger } from '@/components/ui/v3/popover';
import { cn } from '@/lib/utils';

interface DatePickerTriggerProps {
  id?: string;
  date: string | null;
  formatDateFn?: (date: Date) => string;
  emptyLabel: string;
  hasError: boolean;
  onClick: () => void;
}

export default function DatePickerTrigger({
  id,
  date,
  formatDateFn,
  emptyLabel,
  hasError,
  onClick,
}: DatePickerTriggerProps) {
  const parsed = date ? parseISO(date) : null;
  const value = parsed !== null && isValid(parsed) ? parsed : null;

  const label = value
    ? formatDateFn?.(value) || format(value, 'PPP')
    : emptyLabel;

  return (
    <PopoverTrigger asChild>
      <Button
        id={id}
        data-testid="datePickerTrigger"
        variant="outline"
        className={cn('w-full justify-between text-left font-normal', {
          'text-muted-foreground': value === null,
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
