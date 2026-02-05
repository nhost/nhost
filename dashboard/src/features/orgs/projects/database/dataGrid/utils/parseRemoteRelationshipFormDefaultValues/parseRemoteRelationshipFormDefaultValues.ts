import type { BaseRelationshipFormInitialValues } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';
import { defaultFormValues } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';
import {
  isToRemoteSchemaRelationshipDefinition,
  isToSourceRelationshipDefinition,
} from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
import type { RemoteRelationshipDefinition } from '@/utils/hasura-api/generated/schemas';

interface ParseRemoteRelationshipFormDefaultValuesProps {
  definition: RemoteRelationshipDefinition;
  relationshipName: string;
  schema: string;
  tableName: string;
  source: string;
}

export default function parseRemoteRelationshipFormDefaultValues({
  definition,
  schema,
  tableName,
  source,
  relationshipName,
}: ParseRemoteRelationshipFormDefaultValuesProps): BaseRelationshipFormInitialValues {
  if (isToSourceRelationshipDefinition(definition)) {
    const toSourceDefinition = definition.to_source;
    const fieldMappingEntries = Object.entries(
      toSourceDefinition.field_mapping ?? {},
    );

    return {
      name: relationshipName,
      referenceKind: 'table',
      fromSource: {
        schema,
        table: tableName,
        source,
      },
      toReference: {
        schema: toSourceDefinition.table?.schema ?? '',
        table: toSourceDefinition.table?.name ?? '',
        source: toSourceDefinition.source,
      },
      relationshipType:
        toSourceDefinition.relationship_type === 'array'
          ? 'pg_create_array_relationship'
          : 'pg_create_object_relationship',
      fieldMapping: fieldMappingEntries.map(
        ([sourceColumn, referenceColumn]) => ({
          sourceColumn,
          referenceColumn,
        }),
      ),
    };
  }

  if (isToRemoteSchemaRelationshipDefinition(definition)) {
    const { remote_schema, lhs_fields, remote_field } =
      definition.to_remote_schema;

    return {
      name: relationshipName,
      referenceKind: 'remoteSchema',
      fromSource: {
        schema,
        table: tableName,
        source,
      },
      toReference: {
        source: remote_schema,
      },
      remoteSchema: {
        name: remote_schema,
        lhsFields: lhs_fields,
        remoteField: remote_field,
      },
    };
  }
  return defaultFormValues;
}
