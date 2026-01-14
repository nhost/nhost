import { ControlledSelect } from '@/components/form/ControlledSelect';
import { Option } from '@/components/ui/v2/Option';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  CORE_LOG_SERVICE_TO_LABEL,
  CoreLogService,
} from '@/features/orgs/projects/logs/utils/constants/services';
import { isEmptyValue } from '@/lib/utils';
import { useGetServiceLabelValuesQuery } from '@/utils/__generated__/graphql';
import { forwardRef, memo, useMemo } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

type LogsServiceFilterProps = UseFormRegisterReturn<
  keyof {
    service?: string;
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
          label: CORE_LOG_SERVICE_TO_LABEL[CoreLogService.ALL],
          value: CoreLogService.ALL,
        },
        ...data!.getServiceLabelValues.map((l) => ({
          label: CORE_LOG_SERVICE_TO_LABEL[l] ?? l,
          value: l,
        })),
      ];

      return options.map(({ value, label }) => (
        <Option key={value} value={value} className="font-medium text-sm+">
          {label}
        </Option>
      ));
    }, [data]);
    const { onChange, ...selectProps } = props;
    return (
      <ControlledSelect
        {...selectProps}
        ref={ref}
        className="w-full min-w-fit font-normal text-sm"
        placeholder="All Services"
        aria-label="Select service"
        hideEmptyHelperText
        data-testid="ServicePicker"
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
