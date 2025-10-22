import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  GetEventInvocationLogsArgs,
  GetEventInvocationLogsResponse,
} from '@/utils/hasura-api/generated/schemas';
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import fetchEventInvocationLogs from './fetchEventInvocationLogs';

export interface UseGetEventInvocationLogsQueryOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: Omit<
    UseQueryOptions<
      GetEventInvocationLogsResponse,
      unknown,
      GetEventInvocationLogsResponse,
      readonly ['get-event-invocation-logs', string, string, number, number]
    >,
    'queryKey' | 'queryFn'
  >;
}

/**
 * This hook is a wrapper around a fetch call that gets all the invocation logs for a given event trigger.
 *
 * @param args - Arguments for the query.
 * @param args.name - Name of the event trigger to get the invocation logs for
 * @param args.source - Name of the source database of the trigger
 * @param args.limit - Maximum number of invocation logs to be returned in one API call
 * @param args.offset - Offset for the query
 * @returns The result of the query.
 */
export default function useGetEventInvocationLogsQuery(
  args: GetEventInvocationLogsArgs,
  { queryOptions }: UseGetEventInvocationLogsQueryOptions = {},
) {
  const { project, loading } = useProject();

  const query = useQuery(
    [
      'get-event-invocation-logs',
      args.name,
      args.source ?? 'default',
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

      return fetchEventInvocationLogs({
        appUrl,
        adminSecret,
        args,
      });
    },
    {
      keepPreviousData: true,
      ...queryOptions,
      enabled: !!(
        project?.subdomain &&
        project?.region &&
        project?.config?.hasura.adminSecret &&
        args.name &&
        queryOptions?.enabled !== false &&
        !loading
      ),
    },
  );

  return query;
}
