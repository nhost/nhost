import type {
  EventTrigger,
  ExportMetadataResponseMetadata,
  QualifiedTable,
} from '@/utils/hasura-api/generated/schemas';

interface GetEventTriggersByTableArgs {
  /**
   * The exported metadata.
   */
  metadata: ExportMetadataResponseMetadata;
  /**
   * The table to get the event triggers names for.
   */
  table: QualifiedTable;
  /**
   * The data source to get the event triggers names for.
   */
  dataSource: string;
}

export default function getEventTriggersByTable({
  metadata,
  table,
  dataSource,
}: GetEventTriggersByTableArgs): EventTrigger[] {
  if (!metadata?.sources) {
    return [];
  }

  const sourceMetadata = metadata.sources.find(
    (source) => source.name === dataSource,
  );
  if (!sourceMetadata?.tables) {
    return [];
  }

  const tableMetadataItem = sourceMetadata.tables.find(
    (item) =>
      item.table.name === table.name && item.table.schema === table.schema,
  );

  const eventTriggers = tableMetadataItem?.event_triggers ?? [];

  return eventTriggers;
}
