import { useQuery } from '@tanstack/react-query';
import { useAdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { getScheduledEvents } from '@/features/orgs/projects/events/common/api/getScheduledEvents';
import type { EventsSection } from '@/features/orgs/projects/events/common/types';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  GetScheduledEventsResponse,
  ScheduledEventStatus,
} from '@/utils/hasura-api/generated/schemas';

const SECTION_STATUSES: Record<EventsSection, ScheduledEventStatus[]> = {
  scheduled: ['scheduled'],
  failed: ['error', 'dead'],
  processed: ['delivered', 'error', 'dead'],
  all: ['scheduled', 'delivered', 'error', 'dead', 'locked'],
};

/**
 * Number of events in each section of a cron trigger, for the section
 * dropdown. Hasura returns `count` when `get_rows_count` is true.
 */
export default function useCronTriggerEventCounts(triggerName: string) {
  const { project } = useProject();
  const adminApi = useAdminApiTarget();

  return useQuery({
    queryKey: ['cron-trigger-event-counts', project?.subdomain, triggerName],
    queryFn: async () => {
      const sections = Object.keys(SECTION_STATUSES) as EventsSection[];
      const counts = await Promise.all(
        sections.map(async (section) => {
          const response = (await getScheduledEvents({
            appUrl: adminApi!.appUrl,
            adminSecret: adminApi!.adminSecret,
            args: {
              type: 'cron',
              trigger_name: triggerName,
              get_rows_count: true,
              limit: 1,
              offset: 0,
              status: SECTION_STATUSES[section],
            },
          })) as GetScheduledEventsResponse & { count?: number };
          return [section, response.count] as const;
        }),
      );
      return Object.fromEntries(counts) as Record<
        EventsSection,
        number | undefined
      >;
    },
    enabled: Boolean(adminApi && project?.subdomain && triggerName),
    refetchInterval: 30_000,
  });
}
