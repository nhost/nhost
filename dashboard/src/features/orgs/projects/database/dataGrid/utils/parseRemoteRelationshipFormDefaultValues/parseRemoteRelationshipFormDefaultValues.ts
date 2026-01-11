import type { BaseRelationshipFormValues } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';
import { defaultFormValues } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';
import { isToSourceRelationshipDefinition } from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
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
}: ParseRemoteRelationshipFormDefaultValuesProps): BaseRelationshipFormValues {
  if (isToSourceRelationshipDefinition(definition)) {
    const toSourceDefinition = definition.to_source;
    const fieldMappingEntries = Object.entries(
      toSourceDefinition.field_mapping ?? {},
    );

    return {
      name: relationshipName ?? '',
      referenceKind: 'table',
      fromSource: {
        schema,
        table: tableName,
        source,
      },
      toReference: {
        schema: toSourceDefinition.table?.schema ?? '',
        table: toSourceDefinition.table?.name ?? '',
        source: toSourceDefinition.source ?? '',
      },
      relationshipType:
        toSourceDefinition.relationship_type?.toLowerCase() === 'array'
          ? 'array'
          : 'object',
      fieldMapping: fieldMappingEntries.map(
        ([sourceColumn, referenceColumn]) => ({
          sourceColumn,
          referenceColumn,
        }),
      ),
    };
  }
  return defaultFormValues;
  //  if (isToRemoteSchemaRelationshipDefinition(definition)) {
  //   return {
  //     name: relationshipName ?? '',
  //     referenceKind: 'remoteSchema',
  //     fromSource: {
  //       schema,
  //       table: tableName,
  //       source,
  //     },
  //   };
}
