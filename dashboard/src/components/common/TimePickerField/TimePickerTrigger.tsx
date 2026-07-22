'use client';

import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import { PopoverTrigger } from '@/components/ui/v3/popover';
import { cn } from '@/lib/utils';
import isValidTime from './isValidTime';

interface TimePickerTriggerProps {
  id?: string;
  time: string | null;
  emptyLabel: string;
  hasError: boolean;
  utc?: boolean;
  onClick: () => void;
}

export default function TimePickerTrigger({
  id,
  time,
  emptyLabel,
  hasError,
  utc,
  onClick,
}: TimePickerTriggerProps) {
  const isEmpty = !isValidTime(time);

  return (
    <PopoverTrigger asChild>
      <Button
        id={id}
        data-testid="timePickerTrigger"
        variant="outline"
        className={cn('w-full justify-between text-left font-normal', {
          'text-muted-foreground': isEmpty,
          'border-destructive': hasError,
        })}
        onClick={onClick}
      >
        <span className="flex items-center gap-1.5">
          {isEmpty ? emptyLabel : time}
          {utc && !isEmpty && (
            <span className="text-muted-foreground text-xs">UTC</span>
          )}
        </span>
        <Clock className="h-4 w-4" />
      </Button>
    </PopoverTrigger>
  );
}
