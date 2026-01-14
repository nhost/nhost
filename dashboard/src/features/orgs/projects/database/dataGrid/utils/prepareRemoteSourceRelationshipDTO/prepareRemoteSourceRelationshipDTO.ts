import {
  ReferenceSource,
  type TableRelationshipFormValues,
} from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';
import { isNotEmptyValue } from '@/lib/utils';
import type { CreateRemoteRelationshipArgs } from '@/utils/hasura-api/generated/schemas';

export default function prepareRemoteSourceRelationshipDTO(
  values: TableRelationshipFormValues,
): CreateRemoteRelationshipArgs {
  if (values.referenceKind !== 'table') {
    throw new Error('Invalid remote source relationship values');
  }

  const baseTable = {
    schema: values.fromSource.schema,
    name: values.fromSource.table,
  };

  const remoteTable = {
    schema: values.toReference.schema,
    name: values.toReference.table,
  };

  const fieldMappingEntries = values.fieldMapping
    .filter(
      (mapping) =>
        isNotEmptyValue(mapping.sourceColumn) &&
        isNotEmptyValue(mapping.referenceColumn),
    )
    .map((mapping) => [mapping.sourceColumn, mapping.referenceColumn]);

  const fieldMapping = Object.fromEntries(fieldMappingEntries);

  const toSourceName = new ReferenceSource(values.toReference.source).name;

  const args: CreateRemoteRelationshipArgs = {
    name: values.name,
    source: values.fromSource.source,
    table: baseTable,
    definition: {
      to_source: {
        relationship_type: values.relationshipType,
        source: toSourceName,
        table: remoteTable,
        field_mapping: fieldMapping,
      },
    },
  };

  return args;
}
