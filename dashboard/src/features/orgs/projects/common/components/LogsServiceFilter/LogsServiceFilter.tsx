import { memo, useMemo } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { FormSelect } from '@/components/form/FormSelect';
import { SelectItem } from '@/components/ui/v3/select';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  CORE_LOG_SERVICE_TO_LABEL,
  CoreLogService,
} from '@/features/orgs/projects/logs/utils/constants/services';
import { isEmptyValue } from '@/lib/utils';
import { useGetServiceLabelValuesQuery } from '@/utils/__generated__/graphql';
import { localLogsClient } from '@/utils/localLogsClient';

// Shared across log headers that each have their own form shape, so it is
// generic over the form values and only requires the `service` field's name.
interface LogsServiceFilterProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
}

function LogsServiceFilter<TFieldValues extends FieldValues>({
  control,
  name,
}: LogsServiceFilterProps<TFieldValues>) {
  const isPlatform = useIsPlatform();
  const { project } = useProject();
  const { data } = useGetServiceLabelValuesQuery({
    variables: { appID: project?.id },
    skip: !project?.id,
    ...(!isPlatform ? { client: localLogsClient } : {}),
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
      <SelectItem key={value} value={value} className="font-medium text-sm+">
        {label}
      </SelectItem>
    ));
  }, [data]);

  return (
    <FormSelect
      control={control}
      name={name}
      containerClassName="space-y-0"
      className="h-10 w-full font-normal text-sm"
      placeholder="All Services"
      data-testid="ServicePicker"
    >
      {serviceOptions}
    </FormSelect>
  );
}

// `memo` drops the generic call signature, so cast it back to keep callers type-safe.
export default memo(LogsServiceFilter) as typeof LogsServiceFilter;
