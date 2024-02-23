import { ControlledSelect } from '@/components/form/ControlledSelect';
import { Form } from '@/components/form/Form';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { SearchIcon } from '@/components/ui/v2/icons/SearchIcon';
import { Input } from '@/components/ui/v2/Input';
import { Option } from '@/components/ui/v2/Option';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { LogsRangeSelector } from '@/features/projects/logs/components/LogsRangeSelector';
import { AvailableLogsService } from '@/features/projects/logs/utils/constants/services';
import { useGetServiceLabelValuesQuery } from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { subMinutes } from 'date-fns';
import { MINUTES_TO_DECREASE_FROM_CURRENT_DATE } from 'pages/[workspaceSlug]/[appSlug]/logs';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

export interface LogsHeaderProps extends Omit<BoxProps, 'children'> {
  /**
   *
   * Function to be called when the user submits the filters form
   */
  onSubmitFilterValues: (value: LogsFilterFormValues) => void;
}

export const validationSchema = Yup.object({
  from: Yup.date().max(new Date()),
  to: Yup.date().min(new Date()).nullable(),
  service: Yup.string().oneOf(Object.values(AvailableLogsService)),
  regexFilter: Yup.string(),
});

export type LogsFilterFormValues = Yup.InferType<typeof validationSchema>;

export default function LogsHeader({
  onSubmitFilterValues,
  ...props
}: LogsHeaderProps) {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [serviceLabels, setServiceLabels] = useState<
    { label: string; value: string }[]
  >([]);
  const { data, loading } = useGetServiceLabelValuesQuery({
    variables: { appID: currentProject.id },
  });

  useEffect(() => {
    if (!loading) {
      const labels = data.getServiceLabelValues ?? [];
      setServiceLabels(labels.map((l) => ({ label: l, value: l })));
    }
  }, [loading, data]);

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

  const { register } = form;

  const handleSubmit = (values: LogsFilterFormValues) =>
    onSubmitFilterValues(values);

  return (
    <Box
      className="sticky top-0 z-10 grid w-full grid-flow-row gap-x-6 gap-y-2 border-b px-4 py-2.5 lg:grid-flow-col lg:justify-between"
      {...props}
    >
      <FormProvider {...form}>
        <Form
          onSubmit={handleSubmit}
          className="grid w-full grid-flow-row items-center justify-end gap-2 md:w-[initial] md:grid-flow-col md:gap-3 lg:justify-start"
        >
          <ControlledSelect
            {...register('service')}
            className="w-full text-sm font-normal"
            placeholder="All Services"
            aria-label="Select service"
            hideEmptyHelperText
            slotProps={{
              root: { className: 'min-h-[initial] h-10 leading-[initial]' },
            }}
          >
            {[{ label: 'All services', value: '' }, ...serviceLabels].map(
              ({ value, label }) => (
                <Option
                  key={value}
                  value={value}
                  className="text-sm+ font-medium capitalize"
                >
                  {label}
                </Option>
              ),
            )}
          </ControlledSelect>

          <LogsRangeSelector />

          <Input
            {...register('regexFilter')}
            placeholder="Filter logs with a RegExp"
            hideEmptyHelperText
            autoComplete="off"
            fullWidth
            className="min-w-80"
            startAdornment={
              <Box
                className="ml-1 rounded-sm px-2 py-1"
                sx={{ backgroundColor: 'grey.300' }}
              >
                .*
              </Box>
            }
          />

          <Button type="submit" className="h-10" startIcon={<SearchIcon />}>
            Search
          </Button>
        </Form>
      </FormProvider>
    </Box>
  );
}
