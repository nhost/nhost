import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  GetEventLogsArgs,
  GetEventLogsResponse,
} from '@/utils/hasura-api/generated/schemas';
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import fetchEventLogs from './fetchEventLogs';

export interface UseGetEventLogsQueryOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: Omit<
    UseQueryOptions<
      GetEventLogsResponse,
      unknown,
      GetEventLogsResponse,
      readonly ['get-event-logs', string, string, number, number]
    >,
    'queryKey' | 'queryFn'
  >;
}

/**
 * This hook is a wrapper around a fetch call that gets all the event logs for a given event trigger.
 *
 * @param args - Arguments for the query.
 * @param args.name - Name of the event trigger to get the event logs for
 * @param args.source - Name of the source database of the trigger
 * @param args.limit - Maximum number of event logs to be returned in one API call
 * @param args.offset - Offset for the query
 * @param args.status - Status of the event logs to be fetched. If not provided, all types of status are included
 * @returns The result of the query.
 */
export default function useGetEventLogsQuery(
  args: GetEventLogsArgs,
  { queryOptions }: UseGetEventLogsQueryOptions = {},
) {
  const { project, loading } = useProject();

  const query = useQuery(
    [
      'get-event-logs',
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

      return fetchEventLogs({
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
        args.name &&
        queryOptions?.enabled !== false &&
        !loading
      ),
    },
  );

  return query;
}
