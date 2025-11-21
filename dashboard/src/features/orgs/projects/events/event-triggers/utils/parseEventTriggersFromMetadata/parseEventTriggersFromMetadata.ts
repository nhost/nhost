import type { EventTriggerViewModel } from '@/features/orgs/projects/events/event-triggers/types';
import type { ExportMetadataResponseMetadata } from '@/utils/hasura-api/generated/schemas';

export default function parseEventTriggersFromMetadata(
  metadata: ExportMetadataResponseMetadata,
): EventTriggerViewModel[] {
  if (!metadata?.sources) {
    return [];
  }

  return (metadata.sources ?? []).flatMap((source) =>
    (source.tables ?? []).flatMap((table) => {
      const tableName = table.table?.name;
      const schema = table.table?.schema;
      const dataSource = source.name;

      if (!tableName || !schema || !dataSource) {
        return [];
      }

      return (table.event_triggers ?? []).map((trigger) => ({
        ...trigger,
        table: { name: tableName, schema },
        dataSource,
      }));
    }),
  ) satisfies EventTriggerViewModel[];
}
