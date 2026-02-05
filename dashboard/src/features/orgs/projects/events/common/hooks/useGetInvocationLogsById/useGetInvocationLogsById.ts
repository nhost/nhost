import { type UseQueryOptions, useQuery } from '@tanstack/react-query';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { getScheduledEventInvocations } from '@/features/orgs/projects/events/common/api/getScheduledEventInvocations';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  GetScheduledEventInvocationsArgs,
  GetScheduledEventInvocationsResponse,
  InvocationLogEntry,
} from '@/utils/hasura-api/generated/schemas';

export interface UseGetInvocationLogsByIdQueryOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: Omit<
    UseQueryOptions<
      GetScheduledEventInvocationsResponse,
      unknown,
      InvocationLogEntry[],
      readonly [
        'get-invocation-logs-by-id',
        GetScheduledEventInvocationsArgs['type'],
        string,
        number,
        number,
      ]
    >,
    'queryKey' | 'queryFn'
  >;
}

/**
 * This hook is a wrapper around a fetch call that gets the invocation logs for a given event id.
 *
 * @param args - Arguments for the query.
 * @param args.event_id - ID of the event to get the invocation logs for
 * @param args.limit - Maximum number of invocation logs to be returned in one API call
 * @param args.offset - Offset for the query
 * @returns The result of the query.
 */
export default function useGetInvocationLogsById(
  args: GetScheduledEventInvocationsArgs,
  { queryOptions }: UseGetInvocationLogsByIdQueryOptions = {},
) {
  const { project, loading } = useProject();

  const query = useQuery({
    queryKey: [
      'get-invocation-logs-by-id',
      args.type,
      args.event_id,
      args.limit ?? 100,
      args.offset ?? 0,
    ] as const,
    queryFn: () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project!.config!.hasura.adminSecret;

      return getScheduledEventInvocations({
        appUrl,
        adminSecret,
        args: {
          type: args.type,
          event_id: args.event_id,
          get_rows_count: false,
          ...(args.limit && { limit: args.limit }),
          ...(args.offset && { offset: args.offset }),
        },
      });
    },
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
  });

  return query;
}
