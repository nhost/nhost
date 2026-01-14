import type { RemoteSchemaRelationshipFormValues } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';
import type {
  CreateRemoteRelationshipArgs,
  RemoteField,
} from '@/utils/hasura-api/generated/schemas';

export default function prepareRemoteSchemaRelationshipDTO(
  values: RemoteSchemaRelationshipFormValues,
): CreateRemoteRelationshipArgs {
  const selectedRemoteSchema = values.remoteSchema?.remoteSchema ?? '';

  if (!selectedRemoteSchema || !values.remoteSchema?.remoteField) {
    throw new Error('Invalid remote schema relationship values');
  }

  const remoteField = values.remoteSchema.remoteField as RemoteField;

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
