import type { TableRelationshipFormValues } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';
import type { CreateObjectRelationshipArgs } from '@/utils/hasura-api/generated/schemas';

export default function prepareObjectRelationshipDTO(
  values: TableRelationshipFormValues,
): CreateObjectRelationshipArgs {
  if (values.relationshipType !== 'object') {
    throw new Error('Invalid object relationship values');
  }

  const baseTable = {
    schema: values.fromSource.schema,
    name: values.fromSource.table,
  };

  const remoteTable = {
    schema: values.toReference.schema,
    name: values.toReference.table,
  };

  const columnMappingEntries = values.fieldMapping
    .filter((mapping) => mapping.sourceColumn && mapping.referenceColumn)
    .map((mapping) => [mapping.sourceColumn, mapping.referenceColumn]);

  const columnMapping = Object.fromEntries(columnMappingEntries);

  const remoteColumns = values.fieldMapping
    .map((mapping) => mapping.referenceColumn)
    .filter(Boolean);

  const foreignKeyColumn = remoteColumns[0];

  if (!foreignKeyColumn) {
    throw new Error('Invalid array relationship values');
  }

  const args: CreateObjectRelationshipArgs = {
    table: baseTable,
    name: values.name,
    source: values.fromSource.source,
    using: {
      manual_configuration: {
        remote_table: remoteTable,
        column_mapping: columnMapping,
      },
    },
  };

  return args;
}
