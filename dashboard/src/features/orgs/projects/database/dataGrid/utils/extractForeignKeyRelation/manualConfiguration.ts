import type { RelationshipColumnPair } from '@/features/orgs/projects/database/dataGrid/types/relationships';
import { zipRelationshipColumnPairs } from '@/features/orgs/projects/database/dataGrid/utils/buildRelationshipStructuralKey';

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
  const toColumns = entries.map(([, toColumn]) => toColumn);
  if (
    !toColumns.every(
      (toColumn): toColumn is string => typeof toColumn === 'string',
    )
  ) {
    return undefined;
  }

  const columnPairs = zipRelationshipColumnPairs(
    entries.map(([fromColumn]) => fromColumn),
    toColumns,
  );
  if (!columnPairs) {
    return undefined;
  }

  return { columnPairs, table: { name, schema } };
}
