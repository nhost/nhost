import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { getScheduledEventInvocations } from '@/features/orgs/projects/events/common/utils/getScheduledEventInvocations';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MakeRequired } from '@/types/common';
import type {
  CronTriggerInvocationLogEntry,
  GetScheduledEventInvocationsArgs,
  GetScheduledEventInvocationsResponse,
} from '@/utils/hasura-api/generated/schemas';
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

export interface UseGetCronInvocationLogsByIdQueryOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: Omit<
    UseQueryOptions<
      GetScheduledEventInvocationsResponse,
      unknown,
      CronTriggerInvocationLogEntry[],
      readonly ['get-cron-invocation-logs-by-id', string, number, number]
    >,
    'queryKey' | 'queryFn'
  >;
}

type UseGetCronInvocationLogsByIdArgs = MakeRequired<
  Omit<GetScheduledEventInvocationsArgs, 'type'>,
  'event_id'
>;

/**
 * This hook is a wrapper around a fetch call that gets the invocation logs for a given cron trigger id.
 *
 * @param args - Arguments for the query.
 * @param args.event_id - ID of the cron trigger to get the invocation logs for
 * @param args.limit - Maximum number of invocation logs to be returned in one API call
 * @param args.offset - Offset for the query
 * @returns The result of the query.
 */
export default function useGetCronInvocationLogsById(
  args: UseGetCronInvocationLogsByIdArgs,
  { queryOptions }: UseGetCronInvocationLogsByIdQueryOptions = {},
) {
  const { project, loading } = useProject();

  const query = useQuery(
    [
      'get-cron-invocation-logs-by-id',
      args.event_id,
      args.limit ?? 100,
      args.offset ?? 0,
    ],
    () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project?.config?.hasura.adminSecret!;

      return getScheduledEventInvocations({
        appUrl,
        adminSecret,
        args: {
          type: 'cron',
          event_id: args.event_id,
          get_rows_count: false,
          limit: args.limit ?? 100,
          offset: args.offset ?? 0,
        },
      });
    },
    {
      ...queryOptions,
      enabled: !!(
        project?.subdomain &&
        project?.region &&
        project?.config?.hasura.adminSecret &&
        args.event_id &&
        queryOptions?.enabled !== false &&
        !loading
      ),
      select: (data) => data.invocations,
    },
  );

  return query;
}
