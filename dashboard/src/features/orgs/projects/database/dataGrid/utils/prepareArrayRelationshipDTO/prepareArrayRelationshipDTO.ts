import type { TableRelationshipFormValues } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';
import type { CreateArrayRelationshipArgs } from '@/utils/hasura-api/generated/schemas';

export default function prepareArrayRelationshipDTO(
  values: TableRelationshipFormValues,
): CreateArrayRelationshipArgs {
  if (values.relationshipType !== 'array') {
    throw new Error('Invalid array relationship values');
  }

  const baseTable = {
    schema: values.fromSource.schema,
    name: values.fromSource.table,
  };

  const remoteTable = {
    schema: values.toReference.schema,
    name: values.toReference.table,
  };

  const foreignKeyColumn = values.fieldMapping.find((mapping) =>
    Boolean(mapping.referenceColumn),
  )?.referenceColumn;

  if (!foreignKeyColumn) {
    throw new Error('Invalid array relationship values');
  }

  const args: CreateArrayRelationshipArgs = {
    table: baseTable,
    name: values.name,
    source: values.fromSource.source,
    using: {
      foreign_key_constraint_on: {
        table: remoteTable,
        columns: [foreignKeyColumn],
      },
    },
  };

  return args;
}
