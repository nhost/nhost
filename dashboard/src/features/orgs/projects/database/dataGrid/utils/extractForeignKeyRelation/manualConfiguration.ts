import type { RelationshipColumnPair } from '@/features/orgs/projects/database/dataGrid/types/relationships';

interface ManualRelationshipTable {
  name: string;
  schema: string;
}

export interface ParsedManualRelationshipConfiguration {
  columnPairs: RelationshipColumnPair[];
  table: ManualRelationshipTable;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseManualRelationshipConfiguration(
  configuration: unknown,
): ParsedManualRelationshipConfiguration | undefined {
  if (!isRecord(configuration)) {
    return undefined;
  }

  const { column_mapping: columnMapping, remote_table: remoteTable } =
    configuration;
  if (!isRecord(columnMapping) || !isRecord(remoteTable)) {
    return undefined;
  }

  const { name, schema } = remoteTable;
  if (
    typeof name !== 'string' ||
    name.length === 0 ||
    typeof schema !== 'string' ||
    schema.length === 0
  ) {
    return undefined;
  }

  const entries = Object.entries(columnMapping);
  if (
    entries.length === 0 ||
    !entries.every(
      (entry): entry is [string, string] =>
        entry[0].length > 0 &&
        typeof entry[1] === 'string' &&
        entry[1].length > 0,
    )
  ) {
    return undefined;
  }

  const columnPairs = entries.map(([fromColumn, toColumn]) => ({
    fromColumn,
    toColumn,
  }));

  return { columnPairs, table: { name, schema } };
}
