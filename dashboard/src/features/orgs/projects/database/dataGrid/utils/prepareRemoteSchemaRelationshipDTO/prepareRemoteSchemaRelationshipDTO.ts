import type { RemoteSchemaRelationshipFormValues } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';
import { isRemoteField } from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
import type { CreateRemoteRelationshipArgs } from '@/utils/hasura-api/generated/schemas';

export default function prepareRemoteSchemaRelationshipDTO(
  values: RemoteSchemaRelationshipFormValues,
): CreateRemoteRelationshipArgs {
  const selectedRemoteSchema = values.remoteSchema?.name ?? '';
  const rawRemoteField = values.remoteSchema?.remoteField;

  if (
    !selectedRemoteSchema ||
    !rawRemoteField ||
    !isRemoteField(rawRemoteField)
  ) {
    throw new Error('Invalid remote schema relationship values');
  }

  const remoteField = rawRemoteField;

  const args: CreateRemoteRelationshipArgs = {
    name: values.name,
    source: values.fromSource.source,
    table: {
      schema: values.fromSource.schema,
      name: values.fromSource.table,
    },
    definition: {
      to_remote_schema: {
        remote_schema: selectedRemoteSchema,
        lhs_fields: values.remoteSchema.lhsFields ?? [],
        remote_field: remoteField,
      },
    },
  };

  return args;
}
