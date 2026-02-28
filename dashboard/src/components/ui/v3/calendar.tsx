'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, type DayPickerProps } from 'react-day-picker';
import { buttonVariants } from '@/components/ui/v3/button';
import { cn } from '@/lib/utils';

export type CalendarProps = DayPickerProps & {
  /**
   * In the year view, the number of years to display at once.
   * @default 12
   */
  yearRange?: number;

  /**
   * Wether to show the year switcher in the caption.
   * @default true
   */
  showYearSwitcher?: boolean;

  monthsClassName?: string;
  monthCaptionClassName?: string;
  weekdaysClassName?: string;
  weekdayClassName?: string;
  monthClassName?: string;
  captionClassName?: string;
  captionLabelClassName?: string;
  buttonNextClassName?: string;
  buttonPreviousClassName?: string;
  navClassName?: string;
  monthGridClassName?: string;
  weekClassName?: string;
  dayClassName?: string;
  dayButtonClassName?: string;
  rangeStartClassName?: string;
  rangeEndClassName?: string;
  selectedClassName?: string;
  todayClassName?: string;
  outsideClassName?: string;
  disabledClassName?: string;
  rangeMiddleClassName?: string;
  hiddenClassName?: string;
  defaultMonth: Date;
};

/**
 * A custom calendar component built on top of react-day-picker.
 * @param props The props for the calendar.
 * @default yearRange 12
 * @returns
 */
function Calendar({
  className,
  showOutsideDays = true,
  numberOfMonths,
  defaultMonth,
  ...props
}: CalendarProps) {
  const monthsClassName = cn('relative flex', props.monthsClassName);
  const monthCaptionClassName = cn(
    'relative mx-10 flex h-7 items-center justify-center',
    props.monthCaptionClassName,
  );
  const weekdaysClassName = cn('flex flex-row', props.weekdaysClassName);
  const weekdayClassName = cn(
    'w-8 font-normal text-muted-foreground text-sm',
    props.weekdayClassName,
  );
  const monthClassName = cn('w-full', props.monthClassName);
  const captionClassName = cn(
    'relative flex items-center justify-center pt-1',
    props.captionClassName,
  );
  const captionLabelClassName = cn(
    'truncate font-medium text-sm',
    props.captionLabelClassName,
  );
  const buttonNavClassName = buttonVariants({
    variant: 'outline',
    className:
      'absolute h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
  });
  const buttonNextClassName = cn(
    buttonNavClassName,
    'right-0',
    props.buttonNextClassName,
  );
  const buttonPreviousClassName = cn(
    buttonNavClassName,
    'left-0',
    props.buttonPreviousClassName,
  );
  const navClassName = cn('flex items-start', props.navClassName);
  const monthGridClassName = cn('mx-auto mt-4', props.monthGridClassName);
  const weekClassName = cn('mt-2 flex w-max items-start', props.weekClassName);
  const dayClassName = cn(
    'flex size-8 flex-1 items-center justify-center p-0 text-sm',
    props.dayClassName,
  );
  const dayButtonClassName = cn(
    buttonVariants({ variant: 'ghost' }),
    'size-8 rounded-md p-0 font-normal transition-none aria-selected:opacity-100',
    props.dayButtonClassName,
  );
  const buttonRangeClassName =
    'bg-accent [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground';
  const rangeStartClassName = cn(
    buttonRangeClassName,
    'day-range-start rounded-s-md',
    props.rangeStartClassName,
  );
  const rangeEndClassName = cn(
    buttonRangeClassName,
    'day-range-end rounded-e-md',
    props.rangeEndClassName,
  );
  const rangeMiddleClassName = cn(
    '!text-foreground [&>button]:!text-foreground [&>button]:hover:!text-foreground bg-accent [&>button]:bg-transparent [&>button]:hover:bg-transparent',
    props.rangeMiddleClassName,
  );
  const selectedClassName = cn(
    '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground',
    props.selectedClassName,
  );
  const todayClassName = cn(
    '[&>button]:bg-accent [&>button]:text-accent-foreground',
    props.todayClassName,
  );
  const outsideClassName = cn(
    'day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30',
    props.outsideClassName,
  );
  const disabledClassName = cn(
    'text-muted-foreground opacity-50',
    props.disabledClassName,
  );
  const hiddenClassName = cn('invisible flex-1', props.hiddenClassName);

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: monthsClassName,
        month_caption: monthCaptionClassName,
        weekdays: weekdaysClassName,
        weekday: weekdayClassName,
        month: monthClassName,
        caption: captionClassName,
        caption_label: captionLabelClassName,
        button_next: buttonNextClassName,
        button_previous: buttonPreviousClassName,
        nav: navClassName,
        month_grid: monthGridClassName,
        week: weekClassName,
        day: dayClassName,
        day_button: dayButtonClassName,
        range_start: rangeStartClassName,
        range_middle: rangeMiddleClassName,
        range_end: rangeEndClassName,
        selected: selectedClassName,
        today: todayClassName,
        outside: outsideClassName,
        disabled: disabledClassName,
        hidden: hiddenClassName,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === 'left' ? ChevronLeft : ChevronRight;
          return <Icon className="h-4 w-4" />;
        },
      }}
      defaultMonth={defaultMonth}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
