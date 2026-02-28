import { Form } from '@/components/form/Form';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { SearchIcon } from '@/components/ui/v2/icons/SearchIcon';
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

interface LogsHeaderProps extends Omit<BoxProps, 'children'> {
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
  ...props
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

  const { register, watch, getValues, setValue } = form;

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
    <Box
      className="sticky top-0 z-10 grid w-full grid-flow-row gap-x-6 gap-y-2 border-b px-4 py-2.5 lg:grid-flow-col"
      {...props}
    >
      <FormProvider {...form}>
        <Form
          onSubmit={handleSubmit}
          className="grid w-full grid-flow-row items-center gap-2 md:w-[initial] md:grid-flow-col md:gap-3 lg:justify-end"
        >
          <Box className="flex flex-row space-x-2">
            <LogsServiceFilter {...register('service')} />
            <div className="w-full min-w-fit">
              <LogsRangeSelector onSubmitFilterValues={onSubmitFilterValues} />
            </div>
          </Box>
          <LogsRegexFilter {...register('regexFilter')} />

          <Button
            type="submit"
            className="h-10"
            startIcon={
              <div className="flex h-5 w-5 items-center justify-center">
                {loading ? (
                  <ActivityIndicator className="h-5 w-5" />
                ) : (
                  <SearchIcon className="h-5 w-5" />
                )}
              </div>
            }
            disabled={loading}
          >
            Search
          </Button>
        </Form>
      </FormProvider>
    </Box>
  );
}
