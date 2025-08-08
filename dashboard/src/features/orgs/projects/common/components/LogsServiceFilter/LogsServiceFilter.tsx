import { ControlledSelect } from '@/components/form/ControlledSelect';
import { Option } from '@/components/ui/v2/Option';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  AvailableLogsService,
  LOGS_SERVICE_TO_LABEL,
} from '@/features/orgs/projects/logs/utils/constants/services';
import { isEmptyValue } from '@/lib/utils';
import { useGetServiceLabelValuesQuery } from '@/utils/__generated__/graphql';
import { forwardRef, memo, useMemo } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

type LogsServiceFilterProps = UseFormRegisterReturn<
  keyof {
    service?: AvailableLogsService;
  }
>;
const LogsServiceFilter = forwardRef<HTMLButtonElement, LogsServiceFilterProps>(
  (props, ref) => {
    const { project } = useProject();
    const { data } = useGetServiceLabelValuesQuery({
      variables: { appID: project?.id },
      skip: !project?.id,
    });

    const serviceOptions = useMemo(() => {
      if (isEmptyValue(data)) {
        return [];
      }

      const options = [
        {
          label: LOGS_SERVICE_TO_LABEL[AvailableLogsService.ALL],
          value: AvailableLogsService.ALL,
        },
        ...data!.getServiceLabelValues.map((l) => ({
          label: LOGS_SERVICE_TO_LABEL[l] ?? l,
          value: l,
        })),
      ];

      return options.map(({ value, label }) => (
        <Option key={value} value={value} className="text-sm+ font-medium">
          {label}
        </Option>
      ));
    }, [data]);
    const { onChange, ...selectProps } = props;
    return (
      <ControlledSelect
        {...selectProps}
        ref={ref}
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
    );
  },
);

export default memo(LogsServiceFilter);
