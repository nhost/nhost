import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { getScheduledEvents } from '@/features/orgs/projects/events/common/utils/getScheduledEvents';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MakeRequired } from '@/types/common';
import type {
  GetScheduledEventsArgs,
  GetScheduledEventsResponse,
  ScheduledEventLogEntry,
  ScheduledEventStatus,
} from '@/utils/hasura-api/generated/schemas';
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

export interface UseGetCronEventLogsQueryOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: Omit<
    UseQueryOptions<
      GetScheduledEventsResponse,
      unknown,
      ScheduledEventLogEntry[],
      readonly [
        'get-cron-event-logs',
        string,
        'pending' | 'delivered',
        number,
        number,
      ]
    >,
    'queryKey' | 'queryFn'
  >;
}

type UseGetCronEventLogsQueryArgs = MakeRequired<
  Omit<GetScheduledEventsArgs, 'type'>,
  'trigger_name'
> & {
  eventLogsSection: 'pending' | 'delivered';
};

/**
 * This hook is a wrapper around a fetch call that gets the event logs for a given cron trigger name.
 *
 * @param args - Arguments for the query.
 * @param args.trigger_name - Name of the cron trigger to get the event logs for
 * @param args.limit - Maximum number of event logs to be returned in one API call
 * @param args.offset - Offset for the query
 * @returns The result of the query.
 */
export default function useGetCronEventLogsQuery(
  args: UseGetCronEventLogsQueryArgs,
  { queryOptions }: UseGetCronEventLogsQueryOptions = {},
) {
  const { project, loading } = useProject();

  const status: ScheduledEventStatus[] =
    args.eventLogsSection === 'pending'
      ? ['scheduled']
      : ['delivered', 'dead', 'error'];

  const query = useQuery(
    [
      'get-cron-event-logs',
      args.trigger_name,
      args.eventLogsSection,
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

      return getScheduledEvents({
        appUrl,
        adminSecret,
        args: {
          type: 'cron',
          get_rows_count: false,
          limit: args.limit ?? 100,
          offset: args.offset ?? 0,
          trigger_name: args.trigger_name,
          status,
        },
      });
    },
    {
      ...queryOptions,
      enabled: !!(
        project?.subdomain &&
        project?.region &&
        project?.config?.hasura.adminSecret &&
        args.trigger_name &&
        queryOptions?.enabled !== false &&
        !loading
      ),
      select: (data) => data.events,
    },
  );

  return query;
}
