import type {
  DatabaseRelationshipFormValues,
  RemoteSchemaRelationshipFormValues,
} from '@/features/orgs/projects/remote-schemas/components/BaseRemoteSchemaRelationshipForm/';
import type { RemoteSchemaRelationshipType } from '@/features/orgs/projects/remote-schemas/types';
import type { RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem } from '@/utils/hasura-api/generated/schemas/remoteSchemaInfoRemoteRelationshipsItemRelationshipsItem';
import { isToRemoteSchemaRelationshipDefinition } from './guards';

export const getDatabaseRelationshipPayload = (
  values: DatabaseRelationshipFormValues,
) => {
  const args = {
    name: values.name,
    remote_schema: values.sourceRemoteSchema,
    type_name: values.sourceType,
    definition: {
      to_source: {
        table: {
          name: values.table.name,
          schema: values.table.schema,
        },
        field_mapping: values.fieldMapping.reduce(
          (acc, mapping) => ({
            ...acc,
            [mapping.sourceField]: mapping.referenceColumn,
          }),
          {},
        ),
        relationship_type: values.relationshipType,
        source: 'default',
      },
    },
  };

  return args;
};

const getRemoteSchemaLHSFields = (
  mappings: RemoteSchemaRelationshipFormValues['mappings'],
) => {
  const lhsFields = new Set<string>();
  mappings.forEach((mapping) => {
    if (mapping.type === 'sourceTypeField') {
      lhsFields.add(mapping.value);
    }
  });
  return [...lhsFields];
};

export const getRemoteSchemaRelationshipPayload = (
  values: RemoteSchemaRelationshipFormValues,
) => {
  const args = {
    name: values.name,
    remote_schema: values.sourceRemoteSchema,
    type_name: values.sourceType,
    definition: {
      to_remote_schema: {
        remote_schema: values.targetRemoteSchema,
        lhs_fields: getRemoteSchemaLHSFields(values.mappings),
        remote_field: {
          [values.targetField]: {
            arguments: values.mappings.reduce(
              (acc, mapping) => ({
                ...acc,
                [mapping.argument]:
                  mapping.type === 'sourceTypeField'
                    ? `$${mapping.value}`
                    : mapping.value,
              }),
              {},
            ),
          },
        },
      },
    },
  };

  return args;
};

export const getRelationshipFormDefaultValues = (
  relationship: RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem,
  sourceRemoteSchema: string,
  typeName: string,
): RemoteSchemaRelationshipFormValues | DatabaseRelationshipFormValues => {
  if (isToRemoteSchemaRelationshipDefinition(relationship.definition)) {
    return {
      name: relationship.name,
      sourceRemoteSchema,
      sourceType: typeName,
      targetRemoteSchema:
        relationship.definition.to_remote_schema.remote_schema,
      targetField: Object.keys(
        relationship.definition.to_remote_schema.remote_field,
      )[0],
      mappings: Object.entries(
        relationship.definition.to_remote_schema.remote_field[
          Object.keys(relationship.definition.to_remote_schema.remote_field)[0]
        ].arguments || {},
      ).map(([argument, value]) => ({
        argument,
        value:
          typeof value === 'string' && value.startsWith('$')
            ? value.slice(1)
            : value,
        type:
          typeof value === 'string' && value.startsWith('$')
            ? 'sourceTypeField'
            : 'staticValue',
      })),
    } as RemoteSchemaRelationshipFormValues;
  }

  // Database Relationship Form Values
  return {
    name: relationship.name,
    sourceRemoteSchema,
    sourceType: typeName,
    table: {
      name: relationship.definition.to_source.table.name,
      schema: relationship.definition.to_source.table.schema,
    },
    fieldMapping: Object.entries(
      relationship.definition.to_source.field_mapping || {},
    ).map(([sourceField, referenceColumn]) => ({
      sourceField,
      referenceColumn,
    })),
    relationshipType: relationship.definition.to_source.relationship_type,
  } as DatabaseRelationshipFormValues;
};

export const getRelationshipType = (
  relationship: RemoteSchemaInfoRemoteRelationshipsItemRelationshipsItem,
): RemoteSchemaRelationshipType => {
  if (isToRemoteSchemaRelationshipDefinition(relationship.definition)) {
    return 'remote-schema';
  }

  return 'database';
};
