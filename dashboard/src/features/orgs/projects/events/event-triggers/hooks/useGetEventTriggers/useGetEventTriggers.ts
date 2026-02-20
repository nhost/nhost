import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import type { EventTriggerViewModel } from '@/features/orgs/projects/events/event-triggers/types';
import parseEventTriggersFromMetadata from '@/features/orgs/projects/events/event-triggers/utils/parseEventTriggersFromMetadata/parseEventTriggersFromMetadata';

/**
 * This hook is a wrapper around a fetch call that gets the event triggers from the metadata.
 *
 * @returns The result of the query.
 */
export default function useGetEventTriggers() {
  return useExportMetadata((data): EventTriggerViewModel[] =>
    parseEventTriggersFromMetadata(data.metadata),
  );
}
