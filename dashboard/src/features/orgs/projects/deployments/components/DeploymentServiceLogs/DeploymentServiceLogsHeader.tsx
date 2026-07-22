import { yupResolver } from '@hookform/resolvers/yup';
import { SearchIcon } from 'lucide-react';
import { memo, useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { Form } from '@/components/form/Form';
import { Box } from '@/components/ui/v2/Box';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { LogsRegexFilter } from '@/features/orgs/projects/common/components/LogsRegexFilter';
import { LogsServiceFilter } from '@/features/orgs/projects/common/components/LogsServiceFilter';
import { CoreLogService } from '@/features/orgs/projects/logs/utils/constants/services';
import DeploymentInfo from './DeploymentInfo';

export const validationSchema = Yup.object({
  service: Yup.string(),
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
      service: CoreLogService.ALL,
    },
    resolver: yupResolver(validationSchema),
    reValidateMode: 'onSubmit',
  });

  const { watch, getValues } = form;

  const service = watch('service');

  // biome-ignore lint/correctness/useExhaustiveDependencies: need to call onSubmit when service changes
  useEffect(() => {
    onSubmit(getValues());
  }, [service, getValues, onSubmit]);

  return (
    <Box className="h-[180px] w-full pt-8 pb-5">
      <FormProvider {...form}>
        <div className="pb-4">
          <h3 className="text-2xl">Service Logs</h3>
          <DeploymentInfo from={from} to={to} />
        </div>
        <Form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex w-full items-center gap-2 md:w-[initial] md:gap-3"
        >
          <LogsServiceFilter control={form.control} name="service" />
          <LogsRegexFilter {...form.register('regexFilter')} />
          <ButtonWithLoading
            type="submit"
            className="h-10 min-w-min"
            loading={loading}
            loaderClassName="h-5 w-5"
          >
            {!loading && <SearchIcon className="mr-2 h-5 w-5" />}
            Search
          </ButtonWithLoading>
        </Form>
      </FormProvider>
    </Box>
  );
}

export default memo(DeploymentLogsHeader);
