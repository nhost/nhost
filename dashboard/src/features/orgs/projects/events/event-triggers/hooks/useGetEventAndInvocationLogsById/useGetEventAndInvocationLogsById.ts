import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  GetEventAndInvocationLogsByIdArgs,
  GetEventAndInvocationLogsByIdResponse,
} from '@/utils/hasura-api/generated/schemas';
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import fetchEventAndInvocationLogsById from './fetchEventAndInvocationLogsById';

export interface UseGetEventAndInvocationLogsByIdQueryOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: Omit<
    UseQueryOptions<
      GetEventAndInvocationLogsByIdResponse,
      unknown,
      GetEventAndInvocationLogsByIdResponse,
      readonly [
        'get-event-and-invocation-logs-by-id',
        string,
        string,
        number,
        number,
      ]
    >,
    'queryKey' | 'queryFn'
  >;
}

/**
 * This hook is a wrapper around a fetch call that gets the event and invocation logs for a given event id.
 *
 * @param args - Arguments for the query.
 * @param args.event_id - ID of the event to get the invocation logs for
 * @param args.source - Name of the source database of the trigger
 * @param args.invocation_log_limit - Maximum number of invocation logs to be returned in one API call
 * @param args.invocation_log_offset - Offset for the query
 * @returns The result of the query.
 */
export default function useGetEventAndInvocationLogsById(
  args: GetEventAndInvocationLogsByIdArgs,
  { queryOptions }: UseGetEventAndInvocationLogsByIdQueryOptions = {},
) {
  const { project, loading } = useProject();

  const query = useQuery(
    [
      'get-event-and-invocation-logs-by-id',
      args.event_id,
      args.source ?? 'default',
      args.invocation_log_limit ?? 100,
      args.invocation_log_offset ?? 0,
    ],
    () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      const adminSecret = project?.config?.hasura.adminSecret!;

      return fetchEventAndInvocationLogsById({
        appUrl,
        adminSecret,
        args,
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
    },
  );

  return query;
}
