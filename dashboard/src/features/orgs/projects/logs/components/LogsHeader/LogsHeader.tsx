import { Form } from '@/components/form/Form';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { SearchIcon } from 'lucide-react';
import { LogsRegexFilter } from '@/features/orgs/projects/common/components/LogsRegexFilter';
import { LogsServiceFilter } from '@/features/orgs/projects/common/components/LogsServiceFilter';
import { LogsRangeSelector } from '@/features/orgs/projects/logs/components/LogsRangeSelector';
import { CoreLogService } from '@/features/orgs/projects/logs/utils/constants/services';
import { DEFAULT_LOG_INTERVAL } from '@/utils/constants/common';
import { yupResolver } from '@hookform/resolvers/yup';
import { subMinutes } from 'date-fns';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

export const validationSchema = Yup.object({
  from: Yup.string().required(),
  to: Yup.string().nullable(),
  interval: Yup.number().nullable(), // in minutes
  service: Yup.string(),
  regexFilter: Yup.string(),
});

export type LogsFilterFormValues = Yup.InferType<typeof validationSchema>;

interface LogsHeaderProps {
  /**
   * This is used to indicate that a query is currently inflight
   */
  loading: boolean;
  /**
   *
   * Function to be called when the user submits the filters form
   */
  onSubmitFilterValues: (value: LogsFilterFormValues) => void;
  /**
   *
   * Function to be called to force a refetch of the logs when the form is not dirty and the user submits the form
   */
  onRefetch: () => void;
}

export default function LogsHeader({
  loading,
  onSubmitFilterValues,
  onRefetch,
}: LogsHeaderProps) {
  const form = useForm<LogsFilterFormValues>({
    defaultValues: {
      from: subMinutes(new Date(), DEFAULT_LOG_INTERVAL).toISOString(),
      to: new Date().toISOString(),
      regexFilter: '',
      service: CoreLogService.ALL,
      interval: DEFAULT_LOG_INTERVAL,
    },
    resolver: yupResolver(validationSchema),
    reValidateMode: 'onSubmit',
  });
  const { formState } = form;

  const isNotDirty = Object.keys(formState.dirtyFields).length === 0;

  const { register, watch, getValues, setValue, control } = form;

  const service = watch('service');

  // biome-ignore lint/correctness/useExhaustiveDependencies: need to run this hook when service changes
  useEffect(() => {
    onSubmitFilterValues(getValues());
  }, [service, getValues, onSubmitFilterValues]);

  const handleSubmit = (values: LogsFilterFormValues) => {
    // If there's an interval set, recalculate the dates
    if (values.interval) {
      const now = new Date();
      const newValues = {
        ...values,
        from: subMinutes(now, values.interval).toISOString(),
        to: now.toISOString(),
        interval: values.interval,
      };

      // Update form values before submitting, to ensure the dates have the current date if selected an interval
      setValue('from', newValues.from);
      setValue('to', newValues.to);
      setValue('interval', newValues.interval);

      onSubmitFilterValues(newValues);
      return;
    }

    // If the form is not dirty, force a refetch of the logs
    if (isNotDirty) {
      onRefetch();
    }

    onSubmitFilterValues(values);
  };

  return (
    <div className="sticky top-0 z-10 grid w-full grid-flow-row gap-x-6 gap-y-2 border-b px-4 py-2.5 lg:grid-flow-col">
      <FormProvider {...form}>
        <Form
          onSubmit={handleSubmit}
          className="grid w-full grid-flow-row items-center gap-2 md:w-[initial] md:grid-flow-col md:gap-3 lg:justify-end"
        >
          <div className="flex flex-row gap-2">
            <div className="w-60 shrink-0">
              <LogsServiceFilter control={control} name="service" />
            </div>
            <div className="min-w-40 flex-1">
              <LogsRangeSelector onSubmitFilterValues={onSubmitFilterValues} />
            </div>
          </div>
          <LogsRegexFilter {...register('regexFilter')} />

          <ButtonWithLoading
            type="submit"
            loading={loading}
            loaderClassName="h-4 w-4"
          >
            {!loading && <SearchIcon className="mr-2 h-4 w-4" />}
            Search
          </ButtonWithLoading>
        </Form>
      </FormProvider>
    </div>
  );
}
