import { ControlledSelect } from '@/components/form/ControlledSelect';
import { Form } from '@/components/form/Form';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { SearchIcon } from '@/components/ui/v2/icons/SearchIcon';
import { Input } from '@/components/ui/v2/Input';
import { Link } from '@/components/ui/v2/Link';
import { Option } from '@/components/ui/v2/Option';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { LogsRangeSelector } from '@/features/orgs/projects/logs/components/LogsRangeSelector';
import { AvailableLogsService } from '@/features/orgs/projects/logs/utils/constants/services';
import { useGetServiceLabelValuesQuery } from '@/utils/__generated__/graphql';
import { MINUTES_TO_DECREASE_FROM_CURRENT_DATE } from '@/utils/constants/common';
import { yupResolver } from '@hookform/resolvers/yup';
import { subMinutes } from 'date-fns';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

export const validationSchema = Yup.object({
  from: Yup.date(),
  to: Yup.date().nullable(),
  service: Yup.string().oneOf(Object.values(AvailableLogsService)),
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
}

export default function LogsHeader({
  loading,
  onSubmitFilterValues,
  ...props
}: LogsHeaderProps) {
  const { project } = useProject();

  const [serviceLabels, setServiceLabels] = useState<
    { label: string; value: string }[]
  >([]);

  const { data, loading: loadingServiceLabelValues } =
    useGetServiceLabelValuesQuery({
      variables: { appID: project?.id },
      skip: !project?.id,
    });

  useEffect(() => {
    if (!loadingServiceLabelValues && data) {
      const labels = data.getServiceLabelValues ?? [];

      const labelMappings = {
        'hasura-auth': 'Auth',
        'hasura-storage': 'Storage',
        postgres: 'Postgres',
        functions: 'Functions',
        hasura: 'Hasura',
        grafana: 'Grafana',
        'job-backup': 'Backup Jobs',
        ai: 'AI',
      };

      setServiceLabels(
        labels.map((l) => ({ label: labelMappings[l] ?? l, value: l })),
      );
    }
  }, [loadingServiceLabelValues, data]);

  const form = useForm<LogsFilterFormValues>({
    defaultValues: {
      from: subMinutes(new Date(), MINUTES_TO_DECREASE_FROM_CURRENT_DATE),
      to: new Date(),
      regexFilter: '',
      service: AvailableLogsService.ALL,
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  const { register, watch, getValues } = form;

  const service = watch('service');

  useEffect(() => {
    onSubmitFilterValues(getValues());
  }, [service, getValues, onSubmitFilterValues]);

  const handleSubmit = (values: LogsFilterFormValues) =>
    onSubmitFilterValues(values);

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
              {[{ label: 'All services', value: '' }, ...serviceLabels].map(
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
            </ControlledSelect>
            <div className="w-full min-w-fit">
              <LogsRangeSelector onSubmitFilterValues={onSubmitFilterValues} />
            </div>
          </Box>

          <Input
            {...register('regexFilter')}
            placeholder="Filter logs with a regular expression"
            hideEmptyHelperText
            autoComplete="off"
            fullWidth
            className="min-w-80"
            startAdornment={
              <Tooltip
                componentsProps={{
                  tooltip: {
                    sx: {
                      maxWidth: '30rem',
                    },
                  },
                }}
                title={
                  <div className="space-y-4 p-2">
                    <h2>Here are some useful regular expressions:</h2>
                    <ul className="list-disc space-y-2 pl-3">
                      <li>
                        use
                        <code className="mx-1 rounded-md bg-slate-500 px-1 py-px text-slate-100">
                          (?i)error
                        </code>
                        to search for lines with the word <b>error</b> (case
                        insenstive)
                      </li>
                      <li>
                        use
                        <code className="mx-1 rounded-md bg-slate-500 px-1 py-px text-slate-100">
                          error
                        </code>
                        to search for lines with the word <b>error</b> (case
                        sensitive)
                      </li>
                      <li>
                        use
                        <code className="mx-1 rounded-md bg-slate-500 px-1 py-px text-slate-100">
                          /metadata.*error
                        </code>
                        to search for errors in hasura&apos;s metadata endpoint
                      </li>
                      <li>
                        See
                        <Link
                          href="https://github.com/google/re2/wiki/Syntax"
                          target="_blank"
                          rel="noopener noreferrer"
                          underline="hover"
                          className="mx-1"
                        >
                          here
                        </Link>
                        for more patterns
                      </li>
                    </ul>
                  </div>
                }
              >
                <Box className="ml-2 cursor-pointer rounded-full">
                  <InfoIcon
                    aria-label="Info"
                    className="h-5 w-5"
                    color="info"
                  />
                </Box>
              </Tooltip>
            }
          />

          <Button
            type="submit"
            className="h-10"
            startIcon={
              loading ? (
                <ActivityIndicator className="h-4 w-4" />
              ) : (
                <SearchIcon />
              )
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
