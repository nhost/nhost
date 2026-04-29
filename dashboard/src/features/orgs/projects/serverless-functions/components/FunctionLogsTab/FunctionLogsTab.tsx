import { subMinutes } from 'date-fns';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Form } from '@/components/form/Form';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { LogsRegexFilter } from '@/features/orgs/projects/common/components/LogsRegexFilter';
import { LogsBody } from '@/features/orgs/projects/logs/components/LogsBody';
import type { LogsFilterFormValues } from '@/features/orgs/projects/logs/components/LogsHeader';
import { LogsRangeSelector } from '@/features/orgs/projects/logs/components/LogsRangeSelector';
import { CoreLogService } from '@/features/orgs/projects/logs/utils/constants/services';
import { useFunctionLogs } from '@/features/orgs/projects/serverless-functions/hooks/useFunctionLogs';
import type { NhostFunction } from '@/features/orgs/projects/serverless-functions/types';

const DEFAULT_INTERVAL = 15;

export default function FunctionLogsTab({ fn }: { fn: NhostFunction }) {
  const [filters, setFilters] = useState(() => ({
    from: subMinutes(new Date(), DEFAULT_INTERVAL).toISOString(),
    to: new Date().toISOString() as string | null,
    regexFilter: '',
  }));

  const form = useForm<LogsFilterFormValues>({
    defaultValues: {
      from: filters.from,
      to: filters.to,
      regexFilter: '',
      service: CoreLogService.FUNCTIONS,
      interval: DEFAULT_INTERVAL,
    },
  });

  const { data, loading, error } = useFunctionLogs({
    from: filters.from,
    to: filters.to,
    path: fn.route,
    regexFilter: filters.regexFilter,
  });

  const logsData = data ? { logs: data.getFunctionsLogs } : undefined;

  const handleSubmit = (values: LogsFilterFormValues) => {
    if (values.interval) {
      const now = new Date();
      const from = subMinutes(now, values.interval).toISOString();
      const to = now.toISOString();

      form.setValue('from', from);
      form.setValue('to', to);

      setFilters({ from, to, regexFilter: values.regexFilter ?? '' });
      return;
    }

    setFilters({
      from: values.from ?? filters.from,
      to: values.to ?? null,
      regexFilter: values.regexFilter ?? '',
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="grid w-full grid-flow-row gap-x-6 gap-y-2 border-b px-4 py-2.5 lg:grid-flow-col">
        <FormProvider {...form}>
          <Form
            onSubmit={handleSubmit}
            className="grid w-full grid-flow-row items-center gap-2 lg:w-[initial] lg:grid-flow-col lg:justify-end lg:gap-3"
          >
            <div className="w-full min-w-fit">
              <LogsRangeSelector onSubmitFilterValues={handleSubmit} />
            </div>
            <LogsRegexFilter {...form.register('regexFilter')} />
            <ButtonWithLoading
              type="submit"
              loading={loading}
              className="gap-2"
            >
              <Search className="h-4 w-4" />
              Search
            </ButtonWithLoading>
          </Form>
        </FormProvider>
      </div>
      <div className="min-h-0 flex-1">
        <LogsBody
          logsData={logsData}
          loading={loading}
          error={error}
          hideServiceColumn
        />
      </div>
    </div>
  );
}
