import { DateTimePicker } from '@/components/common/DateTimePicker';
import { Button } from '@/components/ui/v3/button';
import { Label } from '@/components/ui/v3/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { LogsFilterFormValues } from '@/features/orgs/projects/logs/components/LogsHeader';
import { DATEPICKER_DISPLAY_FORMAT } from '@/features/orgs/projects/logs/utils/constants/datePicker';
import {
  LOGS_AVAILABLE_INTERVALS,
  type LogsCustomInterval,
} from '@/features/orgs/projects/logs/utils/constants/intervals';
import { cn, isNotEmptyValue } from '@/lib/utils';
import { format, formatDistance, parseISO, startOfDay, subMinutes } from 'date-fns';
import { ChevronDownIcon, ClockIcon } from 'lucide-react';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

function isDayOutsideRange(day: Date, minDate: Date, maxDate: Date) {
  const target = startOfDay(day);
  return target < startOfDay(minDate) || target > startOfDay(maxDate);
}

function formatPickerDate(date: Date | string) {
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  return format(parsed, DATEPICKER_DISPLAY_FORMAT);
}

function LogsToDatePickerLiveButton() {
  const { setValue } = useFormContext<LogsFilterFormValues>();
  const { from, to } = useWatch() as LogsFilterFormValues;
  const isLive = !to;

  function handleLiveButtonClick() {
    if (isLive) {
      setValue('from', subMinutes(new Date(), 20).toISOString());
      setValue('to', new Date().toISOString());
      setValue('interval', null);
      return;
    }

    setValue('to', null);
    setValue('interval', null);
  }

  function handleChangeToDate(newIso: string) {
    setValue('to', newIso);
    setValue('interval', null);
  }

  return (
    <div className="flex flex-col">
      {!isLive && (
        <div className="grid grid-cols-[3.5rem_1fr] items-center gap-x-3">
          <Label className="text-sm+ font-normal text-muted-foreground">
            To
          </Label>
          <DateTimePicker
            key={to}
            dateTime={to}
            triggerTestId="logsToDateTimePickerTrigger"
            onDateTimeChange={handleChangeToDate}
            formatDateFn={formatPickerDate}
            isCalendarDayDisabled={(day) =>
              isDayOutsideRange(day, parseISO(from), new Date())
            }
            validateDateFn={(date) => {
              if (date < parseISO(from)) {
                return '"To" must be later than "From".';
              }
              if (date > new Date()) {
                return '"To" cannot be in the future.';
              }
              return '';
            }}
          />
        </div>
      )}

      <Button
        variant={isLive ? 'default' : 'outline'}
        className={cn(
          'gap-2',
          !isLive && 'mt-4 bg-muted text-muted-foreground',
        )}
        onClick={handleLiveButtonClick}
      >
        <ClockIcon className="h-4 w-4 self-center align-middle" />
        Live
      </Button>
    </div>
  );
}

interface LogsRangeSelectorProps {
  onSubmitFilterValues: (value: LogsFilterFormValues) => void;
}

interface LogsRangeSelectorIntervalPickersProps extends LogsRangeSelectorProps {
  onClose: () => void;
}

function LogsRangeSelectorIntervalPickers({
  onSubmitFilterValues,
  onClose,
}: LogsRangeSelectorIntervalPickersProps) {
  const { project } = useProject();
  const applicationCreationDate = new Date(project?.createdAt);

  const { setValue, getValues } = useFormContext<LogsFilterFormValues>();
  const { from, interval } = useWatch() as LogsFilterFormValues;

  const handleApply = () => {
    onSubmitFilterValues(getValues());
    onClose();
  };

  /**
   * Will subtract the `customInterval` time in minutes from the current date.
   */
  function handleIntervalChange({
    minutesToDecreaseFromCurrentDate,
  }: LogsCustomInterval) {
    setValue(
      'from',
      subMinutes(new Date(), minutesToDecreaseFromCurrentDate).toISOString(),
    );
    setValue('to', new Date().toISOString());
    setValue('interval', minutesToDecreaseFromCurrentDate);
  }

  function handleChangeFromDate(newIso: string) {
    setValue('from', newIso);
    setValue('interval', null);
  }

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col space-y-4">
        <div className="grid grid-cols-[3.5rem_1fr] items-center gap-x-3">
          <Label className="text-sm+ font-normal text-muted-foreground">
            From
          </Label>
          <DateTimePicker
            key={from}
            dateTime={from}
            triggerTestId="logsFromDateTimePickerTrigger"
            onDateTimeChange={handleChangeFromDate}
            formatDateFn={formatPickerDate}
            isCalendarDayDisabled={(day) =>
              isDayOutsideRange(day, applicationCreationDate, new Date())
            }
            validateDateFn={(date) => {
              if (date < applicationCreationDate) {
                return '"From" must be after the project creation date.';
              }
              if (date > new Date()) {
                return '"From" cannot be in the future.';
              }
              return '';
            }}
          />
        </div>

        <LogsToDatePickerLiveButton />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {LOGS_AVAILABLE_INTERVALS.map((logInterval) => (
          <Button
            key={logInterval.label}
            variant="outline"
            className={cn(
              'self-center',
              interval === logInterval.minutesToDecreaseFromCurrentDate &&
                'border-primary text-primary hover:text-primary',
            )}
            onClick={() => handleIntervalChange(logInterval)}
          >
            Last {logInterval.label}
          </Button>
        ))}
      </div>

      <Button onClick={handleApply}>Apply</Button>
    </div>
  );
}

export default function LogsRangeSelector({
  onSubmitFilterValues,
}: LogsRangeSelectorProps) {
  const [open, setOpen] = useState(false);
  const { from, to } = useWatch() as LogsFilterFormValues;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 w-full min-w-40 items-center justify-between"
        >
          <span>
            {isNotEmptyValue(to)
              ? `${formatDistance(parseISO(to).getTime(), parseISO(from).getTime())}`
              : 'Live'}
          </span>
          <ChevronDownIcon className="h-3 w-3" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="mt-1 w-80 p-3">
        <LogsRangeSelectorIntervalPickers
          onSubmitFilterValues={onSubmitFilterValues}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
