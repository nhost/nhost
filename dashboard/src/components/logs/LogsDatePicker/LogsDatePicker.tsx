import { DATEPICKER_DISPLAY_FORMAT } from '@/utils/logs/datepicker';

import type { ButtonProps } from '@/ui/v2/Button';
import Button from '@/ui/v2/Button';
import { Dropdown } from '@/ui/v2/Dropdown';
import CalendarIcon from '@/ui/v2/icons/CalendarIcon';
import ChevronDownIcon from '@/ui/v2/icons/ChevronDownIcon';

import LogsTimePicker from '@/components/logs/LogsTimePicker';
import usePrevious from '@/hooks/usePrevious';
import DatePicker from '@/ui/v2/DatePicker';
import type { DatePickerProps } from '@/ui/v2/DatePicker/DatePicker';
import Text from '@/ui/v2/Text';
import { format } from 'date-fns';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';

export interface LogsDatePickerProps extends DatePickerProps {
  /**
   * Props to be passed to internal components.
   */
  componentsProps?: {
    button?: Partial<ButtonProps>;
  };
  /**
   * Label for the date picker and dropdown trigger.
   */
  label: string;
}

function LogsDatePicker({
  componentsProps,
  label,
  onChange,
  disabled,
  minDate,
  maxDate,
  value,
}: LogsDatePickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(value);
  const { button: buttonSlotProps } = {
    button: componentsProps?.button || {},
  };

  // We want to keep the previous state in the case
  // the `toDate` is set to null. If it's `live` we're
  // going to display the last state set.
  const previousDate = usePrevious(selectedDate);

  return (
    <Dropdown.Root>
      <div className="grid grid-flow-col gap-x-3">
        {label && (
          <Text
            htmlFor={label}
            component="label"
            className="self-center text-sm+ font-normal"
            color="secondary"
          >
            {label}
          </Text>
        )}
        <Dropdown.Trigger asChild hideChevron id={label}>
          <Button
            variant="outlined"
            startIcon={<CalendarIcon className="h-4 w-4 self-center" />}
            endIcon={<ChevronDownIcon className="h-4 w-4 self-center" />}
            {...buttonSlotProps}
            sx={[
              ...(Array.isArray(buttonSlotProps?.sx)
                ? buttonSlotProps.sx
                : [buttonSlotProps.sx]),
              { color: 'text.secondary' },
            ]}
            className={twMerge(
              'text-left transition-all tabular-nums',
              buttonSlotProps?.className,
            )}
          >
            {format(
              value || new Date(previousDate) || new Date(),
              DATEPICKER_DISPLAY_FORMAT,
            )}
          </Button>
        </Dropdown.Trigger>
        <Dropdown.Content>
          <DatePicker
            value={disabled ? previousDate : selectedDate}
            onChange={(newValue) => {
              setSelectedDate(new Date(newValue));
            }}
            minDate={minDate}
            maxDate={maxDate}
          />
          <LogsTimePicker
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            onChange={onChange}
            maxDate={maxDate}
          />
        </Dropdown.Content>
      </div>
    </Dropdown.Root>
  );
}

export default LogsDatePicker;
