import {
  type DistributiveOmit,
  type UseQueryOptions,
  useQuery,
} from '@tanstack/react-query';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { getScheduledEvents } from '@/features/orgs/projects/events/common/api/getScheduledEvents';
import type { EventsSection } from '@/features/orgs/projects/events/common/types';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  GetScheduledEventsArgs,
  GetScheduledEventsArgsType,
  GetScheduledEventsResponse,
  ScheduledEventLogEntry,
  ScheduledEventStatus,
} from '@/utils/hasura-api/generated/schemas';

type ScheduledEventLogsQueryKey = readonly [
  'get-scheduled-event-logs',
  GetScheduledEventsArgsType,
  string | undefined,
  EventsSection,
  number,
  number,
];

export interface UseGetScheduledEventLogsQueryOptions {
  /**
   * Props passed to the underlying query hook.
   */
  queryOptions?: Omit<
    UseQueryOptions<
      GetScheduledEventsResponse,
      unknown,
      ScheduledEventLogEntry[],
      ScheduledEventLogsQueryKey
    >,
    'queryKey' | 'queryFn'
  >;
}

type BaseArgs = DistributiveOmit<
  GetScheduledEventsArgs,
  'type' | 'trigger_name'
> & {
  eventLogsSection: EventsSection;
};

type UseGetScheduledEventLogsQueryArgs =
  | (BaseArgs & { type: 'cron'; trigger_name: string })
  | (BaseArgs & { type: 'one_off' });

/**
 * This hook is a wrapper around a fetch call that gets the event logs for a given scheduled event.
 *
 * @param args - Arguments for the query.
 * @param args.trigger_name - Name of the cron trigger to get the event logs for
 * @param args.limit - Maximum number of event logs to be returned in one API call
 * @param args.offset - Offset for the query
 * @returns The result of the query.
 */
export default function useGetScheduledEventLogsQuery(
  args: UseGetScheduledEventLogsQueryArgs,
  { queryOptions }: UseGetScheduledEventLogsQueryOptions = {},
) {
  const { project, loading } = useProject();

  let status: ScheduledEventStatus[];
  switch (args.eventLogsSection) {
    case 'scheduled':
      status = ['scheduled'];
      break;
    case 'failed':
      status = ['error', 'dead'];
      break;
    case 'processed':
      status = ['delivered', 'error', 'dead'];
      break;
    case 'all':
      status = ['scheduled', 'delivered', 'error', 'dead', 'locked'];
      break;
    default: {
      const exhaustive: never = args.eventLogsSection;
      throw new Error(`Unexpected events section: ${exhaustive}`);
    }
  }

  const query = useQuery<
    GetScheduledEventsResponse,
    unknown,
    ScheduledEventLogEntry[],
    ScheduledEventLogsQueryKey
  >({
    queryKey: [
      'get-scheduled-event-logs',
      args.type,
      args.type === 'cron' ? args.trigger_name : undefined,
      args.eventLogsSection,
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

      return getScheduledEvents({
        appUrl,
        adminSecret,
        args: {
          type: args.type,
          get_rows_count: false,
          limit: args.limit ?? 100,
          offset: args.offset ?? 0,
          ...(args.type === 'cron' ? { trigger_name: args.trigger_name } : {}),
          status,
        },
      });
    },
    ...queryOptions,
    enabled: !!(
      project?.subdomain &&
      project?.region &&
      project?.config?.hasura.adminSecret &&
      (args.type === 'one_off' || args.trigger_name) &&
      queryOptions?.enabled !== false &&
      !loading
    ),
    select: (data) => data.events,
  });

  return query;
}
