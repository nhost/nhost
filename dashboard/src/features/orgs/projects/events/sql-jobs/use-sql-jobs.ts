import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { POSTGRES_EXTENSIONS_QUERY_KEY } from '@/features/orgs/projects/database/extensions/hooks/usePostgresExtensionsQuery';
import {
  executeSqlJobChange,
  fetchSqlJobRows,
  SQL_JOBS_QUERY_KEY,
} from '@/features/orgs/projects/events/sql-jobs/api';
import {
  CRON_STATE_SQL,
  getJobRunCountsSql,
  getJobRunsSql,
  SQL_JOBS_SQL,
  type SqlJobRunFilter,
} from '@/features/orgs/projects/events/sql-jobs/sql';
import type {
  CronState,
  SqlJob,
  SqlJobChange,
  SqlJobRun,
  SqlJobRunCounts,
} from '@/features/orgs/projects/events/sql-jobs/types';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export function useCronState() {
  const target = useAdminApiTarget();
  const { project } = useProject();
  return useQuery({
    queryKey: [SQL_JOBS_QUERY_KEY, project?.subdomain, 'state'],
    queryFn: async () => {
      const [state] = await fetchSqlJobRows<CronState>(target!, CRON_STATE_SQL);
      if (!state) {
        throw new Error('Postgres did not return the scheduler configuration.');
      }
      return state;
    },
    enabled: Boolean(target),
  });
}

export function useSqlJobs(enabled: boolean) {
  const target = useAdminApiTarget();
  const { project } = useProject();
  return useQuery({
    queryKey: [SQL_JOBS_QUERY_KEY, project?.subdomain, 'jobs'],
    queryFn: () => fetchSqlJobRows<SqlJob>(target!, SQL_JOBS_SQL),
    enabled: Boolean(target) && enabled,
    refetchInterval: enabled ? 15_000 : false,
  });
}

export function useSqlJobRuns(
  job: SqlJob,
  offset: number,
  limit: number,
  filter: SqlJobRunFilter = 'all',
) {
  const target = useAdminApiTarget();
  const { project } = useProject();
  return useQuery({
    queryKey: [
      SQL_JOBS_QUERY_KEY,
      project?.subdomain,
      'runs',
      job.jobid,
      filter,
      offset,
      limit,
    ],
    queryFn: () =>
      fetchSqlJobRows<SqlJobRun>(
        target!,
        getJobRunsSql(job.jobid, offset, limit, filter),
      ),
    enabled: Boolean(target),
    refetchInterval: 10_000,
  });
}

export function useSqlJobRunCounts(job: SqlJob) {
  const target = useAdminApiTarget();
  const { project } = useProject();
  return useQuery({
    queryKey: [SQL_JOBS_QUERY_KEY, project?.subdomain, 'run-counts', job.jobid],
    queryFn: async () => {
      const [counts] = await fetchSqlJobRows<SqlJobRunCounts>(
        target!,
        getJobRunCountsSql(job.jobid),
      );
      return counts ?? { all: 0, succeeded: 0, failed: 0, running: 0 };
    },
    enabled: Boolean(target),
    refetchInterval: 10_000,
  });
}

export function useSqlJobMutation() {
  const target = useAdminApiTarget();
  const isPlatform = useIsPlatform();
  const { project } = useProject();
  const queryClient = useQueryClient();
  return useMutation<void, Error, SqlJobChange>({
    mutationFn: (change) => {
      if (!target) {
        throw new Error('The project connection is not available.');
      }
      return executeSqlJobChange(target, isPlatform, change);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: [SQL_JOBS_QUERY_KEY, project?.subdomain],
        }),
        queryClient.invalidateQueries({
          queryKey: [POSTGRES_EXTENSIONS_QUERY_KEY, project?.subdomain],
        }),
      ]),
  });
}
