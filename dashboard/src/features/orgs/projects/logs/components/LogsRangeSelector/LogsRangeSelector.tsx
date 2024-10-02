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
import { ChevronDownIcon } from '@graphiql/react';
import { formatDistance, subMinutes } from 'date-fns';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';

function LogsToDatePickerLiveButton() {
  const [currentTime, setCurrentTime] = useState(new Date());

  const { setValue } = useFormContext<LogsFilterFormValues>();
  const { from, to } = useWatch<LogsFilterFormValues>();
  const isLive = !to;

  function handleLiveButtonClick() {
    if (isLive) {
      setValue('from', subMinutes(new Date(), 20));
      setValue('to', new Date());
      return;
    }

    setValue('to', null);
    setCurrentTime(new Date());
  }

  useInterval(() => setCurrentTime(new Date()), isLive ? 1000 : 0);

  return (
    <div className="flex flex-col text-greyscaleMedium">
      {!isLive && (
        <LogsDatePicker
          label="To"
          value={!isLive ? to : currentTime}
          disabled={isLive}
          onChange={(date: Date) => setValue('to', date)}
          minDate={from}
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
        startIcon={<ClockIcon className="self-center w-4 h-4 align-middle" />}
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
  const applicationCreationDate = new Date(project.createdAt);

  const { setValue, getValues } = useFormContext<LogsFilterFormValues>();
  const { from } = useWatch<LogsFilterFormValues>();

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
    setValue('from', subMinutes(new Date(), minutesToDecreaseFromCurrentDate));
    setValue('to', new Date());
  }

  return (
    <Box className="flex flex-col space-y-4">
      <div className="flex flex-col space-y-4">
        <LogsDatePicker
          label="From"
          value={from}
          onChange={(date) => setValue('from', date)}
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
            color="secondary"
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
  const { from, to } = useWatch<LogsFilterFormValues>();

  return (
    <Dropdown.Root>
      <Dropdown.Trigger hideChevron className="flex w-full rounded-full">
        <Button
          component="a"
          className="items-center justify-between w-full h-10 min-w-40"
          variant="outlined"
        >
          <span>
            {to === null
              ? 'Live'
              : `${formatDistance(to.getTime(), from.getTime())}`}
          </span>
          <ChevronDownIcon className="w-3 h-3" />
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
