import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Dropdown, useDropdown } from '@/components/ui/v2/Dropdown';
import { ClockIcon } from '@/components/ui/v2/icons/ClockIcon';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { LogsDatePicker } from '@/features/orgs/projects/logs/components/LogsDatePicker';
import type { LogsFilterFormValues } from '@/features/orgs/projects/logs/components/LogsHeader';
import {
  LOGS_AVAILABLE_INTERVALS,
  type LogsCustomInterval,
} from '@/features/orgs/projects/logs/utils/constants/intervals';
import { useInterval } from '@/hooks/useInterval';
import { isNotEmptyValue } from '@/lib/utils';
import { ChevronDownIcon } from '@graphiql/react';
import { formatDistance, parseISO, subMinutes } from 'date-fns';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';

function LogsToDatePickerLiveButton() {
  const [currentTime, setCurrentTime] = useState(new Date());

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
    setCurrentTime(new Date());
    setValue('interval', null);
  }

  function handleChangeToDate(date: Date) {
    setValue('to', date.toISOString());
    setValue('interval', null);
  }

  useInterval(() => setCurrentTime(new Date()), isLive ? 1000 : 0);

  return (
    <div className="text-greyscaleMedium flex flex-col">
      {!isLive && (
        <LogsDatePicker
          label="To"
          value={!isLive ? parseISO(to) : currentTime}
          disabled={isLive}
          onChange={handleChangeToDate}
          minDate={parseISO(from)}
          maxDate={new Date()}
          componentsProps={{
            button: {
              className: twMerge('rounded-r-none', isLive ? 'z-0' : 'z-10'),
              color: to ? 'inherit' : 'secondary',
            },
          }}
        />
      )}

      <Button
        variant="outlined"
        color={isLive ? 'primary' : 'secondary'}
        sx={{
          backgroundColor: (theme) =>
            !isLive ? `${theme.palette.grey[200]} !important` : 'transparent',
          color: !isLive ? 'text.secondary' : undefined,
        }}
        className={twMerge(!isLive ? 'z-0 mt-4' : 'z-10')}
        startIcon={<ClockIcon className="h-4 w-4 self-center align-middle" />}
        onClick={handleLiveButtonClick}
      >
        Live
      </Button>
    </div>
  );
}

interface LogsRangeSelectorProps {
  onSubmitFilterValues: (value: LogsFilterFormValues) => void;
}

function LogsRangeSelectorIntervalPickers({
  onSubmitFilterValues,
}: LogsRangeSelectorProps) {
  const { project } = useProject();
  const applicationCreationDate = new Date(project?.createdAt);

  const { setValue, getValues } = useFormContext<LogsFilterFormValues>();
  const { from, interval } = useWatch() as LogsFilterFormValues;

  const { handleClose } = useDropdown();

  const handleApply = () => {
    onSubmitFilterValues(getValues());
    handleClose();
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

  function handleChangeFromDate(date: Date) {
    setValue('from', date.toISOString());
    setValue('interval', null);
  }

  return (
    <Box className="flex flex-col space-y-4">
      <div className="flex flex-col space-y-4">
        <LogsDatePicker
          label="From"
          value={parseISO(from)}
          onChange={handleChangeFromDate}
          minDate={applicationCreationDate}
          maxDate={new Date()}
        />

        <LogsToDatePickerLiveButton />
      </div>

      <Box className="grid grid-cols-2 gap-2">
        {LOGS_AVAILABLE_INTERVALS.map((logInterval) => (
          <Button
            key={logInterval.label}
            variant="outlined"
            color={
              interval === logInterval.minutesToDecreaseFromCurrentDate
                ? 'primary'
                : 'secondary'
            }
            className="self-center"
            onClick={() => handleIntervalChange(logInterval)}
          >
            Last {logInterval.label}
          </Button>
        ))}
      </Box>

      <Button color="primary" variant="contained" onClick={handleApply}>
        Apply
      </Button>
    </Box>
  );
}

export default function LogsRangeSelector({
  onSubmitFilterValues,
}: LogsRangeSelectorProps) {
  const { from, to } = useWatch() as LogsFilterFormValues;

  return (
    <Dropdown.Root>
      <Dropdown.Trigger hideChevron className="flex w-full rounded-full">
        <Button
          component="a"
          className="h-10 w-full min-w-40 items-center justify-between"
          variant="outlined"
        >
          <span>
            {isNotEmptyValue(to)
              ? `${formatDistance(parseISO(to).getTime(), parseISO(from).getTime())}`
              : 'Live'}
          </span>
          <ChevronDownIcon className="h-3 w-3" />
        </Button>
      </Dropdown.Trigger>

      <Dropdown.Content PaperProps={{ className: 'mt-1 max-w-xs w-full p-3' }}>
        <LogsRangeSelectorIntervalPickers
          onSubmitFilterValues={onSubmitFilterValues}
        />
      </Dropdown.Content>
    </Dropdown.Root>
  );
}
