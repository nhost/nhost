import type { TableRelationshipFormValues } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';
import type { CreateLocalRelationshipArgs } from '@/utils/hasura-api/generated/schemas';

export default function prepareLocalRelationshipDTO(
  values: TableRelationshipFormValues,
): CreateLocalRelationshipArgs {
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

  const args: CreateLocalRelationshipArgs = {
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
