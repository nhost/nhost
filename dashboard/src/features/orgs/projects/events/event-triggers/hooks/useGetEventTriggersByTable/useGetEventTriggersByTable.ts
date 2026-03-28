import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { getEventTriggersByTable } from '@/features/orgs/projects/events/event-triggers/utils/getEventTriggersByTable';
import type {
  EventTrigger,
  QualifiedTable,
} from '@/utils/hasura-api/generated/schemas';

export interface UseGetEventTriggersByTableOptions {
  queryOptions?: { enabled?: boolean };
  table: QualifiedTable;
  dataSource: string;
}

/**
 * This hook is a wrapper around a fetch call that gets the event triggers by table from the metadata.
 *
 * @param options - Options to use for the query.
 * @returns The result of the query.
 */
export default function useGetEventTriggersByTable({
  table,
  dataSource,
  queryOptions,
}: UseGetEventTriggersByTableOptions) {
  return useExportMetadata(
    (data): EventTrigger[] =>
      getEventTriggersByTable({
        metadata: data.metadata,
        table,
        dataSource,
      }),
    { enabled: queryOptions?.enabled },
  );
}
