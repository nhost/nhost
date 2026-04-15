import { useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Form } from '@/components/form/Form';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { SearchIcon } from '@/components/ui/v2/icons/SearchIcon';
import { LogsRegexFilter } from '@/features/orgs/projects/common/components/LogsRegexFilter';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { LogsBody } from '@/features/orgs/projects/logs/components/LogsBody';
import type { LogsFilterFormValues } from '@/features/orgs/projects/logs/components/LogsHeader';
import { LogsRangeSelector } from '@/features/orgs/projects/logs/components/LogsRangeSelector';
import { CoreLogService } from '@/features/orgs/projects/logs/utils/constants/services';
import type { NhostFunction } from '@/features/orgs/projects/serverless-functions/types';
import type { GetProjectLogsQuery } from '@/utils/__generated__/graphql';
import { useGetFunctionsLogsQuery } from '@/utils/__generated__/graphql';
import { splitGraphqlClient } from '@/utils/splitGraphqlClient';
import { subMinutes } from 'date-fns';

const DEFAULT_INTERVAL = 15;

export default function FunctionLogsTab({ fn }: { fn: NhostFunction }) {
  const { project } = useProject();

  const [filters, setFilters] = useState(() => ({
    from: subMinutes(new Date(), DEFAULT_INTERVAL).toISOString(),
    to: new Date().toISOString(),
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

  const { data, loading, error } = useGetFunctionsLogsQuery({
    variables: {
      appID: project?.id,
      from: filters.from,
      to: filters.to,
      path: fn.route,
    },
    client: splitGraphqlClient,
    skip: !project?.id,
  });

  const logsData = useMemo(() => {
    if (!data) {
      return undefined;
    }

    let { getFunctionsLogs: logs } = data;

    if (filters.regexFilter) {
      try {
        const regex = new RegExp(filters.regexFilter);
        logs = logs.filter((log) => regex.test(log.log));
      } catch {
        // invalid regex, show all logs
      }
    }

    return { logs } as unknown as GetProjectLogsQuery;
  }, [data, filters.regexFilter]);

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
      to: values.to ?? new Date().toISOString(),
      regexFilter: values.regexFilter ?? '',
    });
  };

  return (
    <div className="flex h-full flex-col">
      <Box className="grid w-full grid-flow-row gap-x-6 gap-y-2 border-b px-4 py-2.5 lg:grid-flow-col">
        <FormProvider {...form}>
          <Form
            onSubmit={handleSubmit}
            className="grid w-full grid-flow-row items-center gap-2 md:w-[initial] md:grid-flow-col md:gap-3 lg:justify-end"
          >
            <div className="w-full min-w-fit">
              <LogsRangeSelector onSubmitFilterValues={handleSubmit} />
            </div>
            <LogsRegexFilter {...form.register('regexFilter')} />
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
      <div className="min-h-0 flex-1">
        <LogsBody logsData={logsData} loading={loading} error={error} hideServiceColumn />
      </div>
    </div>
  );
}
