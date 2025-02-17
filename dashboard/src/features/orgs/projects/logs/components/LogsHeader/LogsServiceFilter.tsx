import { ControlledSelect } from '@/components/form/ControlledSelect';
import { memo } from 'react';
import type { UseFormRegister } from 'react-hook-form';
import type { LogsFilterFormValues } from './LogsHeader';

interface LogsServiceFilterProps {
  register: UseFormRegister<LogsFilterFormValues>;
  serviceOptions: JSX.Element[];
}
const LogsServiceFilter = memo(
  ({ register, serviceOptions }: LogsServiceFilterProps) => (
    <ControlledSelect
      {...register('service')}
      className="w-full min-w-fit text-sm font-normal"
      placeholder="All Services"
      aria-label="Select service"
      hideEmptyHelperText
      slotProps={{
        root: {
          className: 'min-h-[initial] h-10 leading-[initial]',
        },
      }}
    >
      {serviceOptions}
    </ControlledSelect>
  ),
);

export default LogsServiceFilter;
