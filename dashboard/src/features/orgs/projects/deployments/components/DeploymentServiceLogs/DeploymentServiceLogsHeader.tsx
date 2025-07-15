import { Form } from '@/components/form/Form';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { LogsRegexFilter } from '@/features/orgs/projects/common/components/LogsRegexFilter';
import { LogsServiceFilter } from '@/features/orgs/projects/common/components/LogsServiceFilter';
import { AvailableLogsService } from '@/features/orgs/projects/logs/utils/constants/services';
import { yupResolver } from '@hookform/resolvers/yup';
import { SearchIcon } from 'lucide-react';
import { memo, useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import DeploymentInfo from './DeploymentInfo';

export const validationSchema = Yup.object({
  service: Yup.string().oneOf(Object.values(AvailableLogsService)).required(),
  regexFilter: Yup.string().required(),
}).required();

export type DeploymentLogsFormValues = Yup.InferType<typeof validationSchema>;

interface Props {
  onSubmit: (values: DeploymentLogsFormValues) => void;
  loading: boolean;
  from: string;
  to: string | null;
}

function DeploymentLogsHeader({ onSubmit, loading, from, to }: Props) {
  const form = useForm<DeploymentLogsFormValues>({
    defaultValues: {
      regexFilter: '',
      service: AvailableLogsService.ALL,
    },
    resolver: yupResolver(validationSchema),
    reValidateMode: 'onSubmit',
  });

  const { watch, getValues } = form;

  const service = watch('service');

  useEffect(() => {
    onSubmit(getValues());
  }, [service, getValues, onSubmit]);

  return (
    <Box className="h-[180px] w-full pb-5 pt-8">
      <FormProvider {...form}>
        <div className="pb-4">
          <h3 className="text-2xl">Service Logs</h3>
          <DeploymentInfo from={from} to={to} />
        </div>
        <Form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex w-full items-center gap-2 md:w-[initial] md:gap-3"
        >
          <LogsServiceFilter {...form.register('service')} />
          <LogsRegexFilter {...form.register('regexFilter')} />
          <Button
            type="submit"
            className="h-10 min-w-min"
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

export default memo(DeploymentLogsHeader);
