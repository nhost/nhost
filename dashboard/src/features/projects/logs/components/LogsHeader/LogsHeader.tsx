import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { ClockIcon } from '@/components/ui/v2/icons/ClockIcon';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { LogsDatePicker } from '@/features/projects/logs/components/LogsDatePicker';
import type { LogsCustomInterval } from '@/features/projects/logs/utils/constants/intervals';
import { LOGS_AVAILABLE_INTERVALS } from '@/features/projects/logs/utils/constants/intervals';
import type { AvailableLogsService } from '@/features/projects/logs/utils/constants/services';
import { LOGS_AVAILABLE_SERVICES } from '@/features/projects/logs/utils/constants/services';
import { useGetRunServicesQuery } from '@/utils/__generated__/graphql';
import { subMinutes } from 'date-fns';
import { useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';

export interface LogsHeaderProps extends Omit<BoxProps, 'children'> {
  /**
   * The date to be displayed in the date picker for the from date.
   */
  fromDate: Date;
  /**
   * The date to be displayed in the date picker for the to date.
   */
  toDate: Date | null;
  /**
   * Service to where to fetch logs from.
   */
  service: AvailableLogsService;
  /**
   * Function to be called when the user changes the from date.
   */
  onFromDateChange: (value: Date) => void;
  /**
   * Function to be called when the user changes the `to` date.
   */
  onToDateChange: (value: Date) => void;
  /**
   * Function to be called when the user changes service to which to query logs from.
   */
  onServiceChange: (value: AvailableLogsService) => void;
}

type LogsToDatePickerLiveButtonProps = Pick<
  LogsHeaderProps,
  'fromDate' | 'toDate' | 'onToDateChange'
>;

function LogsToDatePickerLiveButton({
  fromDate,
  toDate,
  onToDateChange,
}: LogsToDatePickerLiveButtonProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const isLive = !toDate;

  function handleLiveButtonClick() {
    if (isLive) {
      return;
    }

    onToDateChange(null);
    setCurrentTime(new Date());
  }

  // if isLive is true, we want to update the current time every second
  // and set the toDate to the current time.
  useEffect(() => {
    let interval = null;

    if (!interval && isLive) {
      interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
    }

    return () => {
      clearInterval(interval);
    };
  }, [isLive, onToDateChange]);

  return (
    <div className="text-greyscaleMedium grid grid-flow-col">
      <LogsDatePicker
        label="To"
        value={!isLive ? toDate : currentTime}
        disabled={isLive}
        onChange={onToDateChange}
        minDate={fromDate}
        maxDate={toDate || new Date()}
        componentsProps={{
          button: {
            className: twMerge(
              'rounded-r-none pr-3',
              isLive ? 'border-r-0 hover:border-r-0 z-0' : 'z-10',
            ),
            color: toDate ? 'inherit' : 'secondary',
          },
        }}
      />

      <Button
        variant="outlined"
        color={isLive ? 'primary' : 'secondary'}
        sx={{
          backgroundColor: (theme) =>
            !isLive ? `${theme.palette.grey[200]} !important` : 'transparent',
          color: !isLive ? 'text.secondary' : undefined,
        }}
        className={twMerge(
          'min-w-[77px] rounded-l-none',
          !isLive ? 'z-0 border-l-0 hover:border-l-0' : 'z-10',
        )}
        startIcon={<ClockIcon className="h-4 w-4 self-center align-middle" />}
        onClick={handleLiveButtonClick}
      >
        Live
      </Button>
    </div>
  );
}

export default function LogsHeader({
  fromDate,
  toDate,
  service,
  onFromDateChange,
  onToDateChange,
  onServiceChange,
  ...props
}: LogsHeaderProps) {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const applicationCreationDate = new Date(currentProject.createdAt);

  const [runServices, setRunServices] = useState<
    {
      label: string;
      value: string;
    }[]
  >([]);

  const { data, loading } = useGetRunServicesQuery({
    variables: {
      appID: currentProject.id,
      resolve: false,
      limit: 1000,
      offset: 0,
    },
  });

  useEffect(() => {
    if (!loading) {
      const services = data.app?.runServices ?? [];

      setRunServices(
        services.map((s) => ({
          label: s.config.name,
          value: s.config.name,
        })),
      );
    }
  }, [loading, data]);

  /**
   * Will subtract the `customInterval` time in minutes from the current date.
   */
  function handleIntervalChange({
    minutesToDecreaseFromCurrentDate,
  }: LogsCustomInterval) {
    onFromDateChange(subMinutes(new Date(), minutesToDecreaseFromCurrentDate));
    onToDateChange(new Date());
  }

  return (
    <Box
      className="sticky top-0 z-10 grid w-full grid-flow-row gap-x-6 gap-y-2 border-b py-2.5 px-4 lg:grid-flow-col lg:justify-between"
      {...props}
    >
      <Box className="grid w-full grid-flow-row items-center justify-center gap-2 md:w-[initial] md:grid-flow-col md:gap-3 lg:justify-start">
        <div className="grid grid-flow-col items-center gap-3 md:justify-start">
          <LogsDatePicker
            label="From"
            value={fromDate}
            onChange={onFromDateChange}
            minDate={applicationCreationDate}
            maxDate={toDate || new Date()}
          />

          <LogsToDatePickerLiveButton
            fromDate={fromDate}
            toDate={toDate}
            onToDateChange={onToDateChange}
          />
        </div>

        <Box className="-my-2.5 px-0 py-2.5 lg:border-l lg:px-3">
          <Select
            className="w-full text-sm font-normal"
            placeholder="All Services"
            onChange={(_e, value) => {
              if (typeof value !== 'string') {
                return;
              }
              onServiceChange(value as AvailableLogsService);
            }}
            value={service}
            aria-label="Select service"
            hideEmptyHelperText
            slotProps={{
              root: { className: 'min-h-[initial] h-9 leading-[initial]' },
            }}
          >
            {[...LOGS_AVAILABLE_SERVICES, ...runServices].map(
              ({ value, label }) => (
                <Option
                  key={value}
                  value={value}
                  className="text-sm+ font-medium"
                >
                  {label}
                </Option>
              ),
            )}
          </Select>
        </Box>
      </Box>

      <Box className="hidden grid-flow-col items-center justify-center gap-3 md:grid lg:justify-end">
        {LOGS_AVAILABLE_INTERVALS.map((logInterval) => (
          <Button
            key={logInterval.label}
            variant="outlined"
            color="secondary"
            className="self-center"
            onClick={() => handleIntervalChange(logInterval)}
          >
            {logInterval.label}
          </Button>
        ))}
      </Box>
    </Box>
  );
}
