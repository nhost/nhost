import type {
  NativeQueryItem,
  NativeQueryRelationship,
} from '@/utils/hasura-api/generated/schemas';

export type NativeQueryRelationshipKind = 'object' | 'array';

export interface NativeQueryRelationshipFieldMapping {
  sourceField: string;
  targetField: string;
}

export interface NativeQueryRelationshipInput {
  name: string;
  kind: NativeQueryRelationshipKind;
  remoteNativeQuery: string;
  fieldMappings: NativeQueryRelationshipFieldMapping[];
  insertionOrder: 'before_parent' | 'after_parent' | null;
}

export const fieldMappingsToColumnMapping = (
  mappings: NativeQueryRelationshipFieldMapping[],
): Record<string, string> =>
  Object.fromEntries(
    mappings.map(({ sourceField, targetField }) => [sourceField, targetField]),
  );

export const columnMappingToFieldMappings = (
  columnMapping: Record<string, string>,
): NativeQueryRelationshipFieldMapping[] =>
  Object.entries(columnMapping).map(([sourceField, targetField]) => ({
    sourceField,
    targetField,
  }));

const toRelationship = (
  input: NativeQueryRelationshipInput,
): NativeQueryRelationship => ({
  name: input.name,
  using: {
    column_mapping: fieldMappingsToColumnMapping(input.fieldMappings),
    insertion_order: input.insertionOrder,
    remote_native_query: input.remoteNativeQuery,
  },
});

export const hasNativeQueryRelationshipName = (
  query: NativeQueryItem,
  name: string,
  ignoredName?: string,
): boolean =>
  [
    ...(query.object_relationships ?? []),
    ...(query.array_relationships ?? []),
  ].some(
    (relationship) =>
      relationship.name === name && relationship.name !== ignoredName,
  );

export const addNativeQueryRelationship = (
  query: NativeQueryItem,
  input: NativeQueryRelationshipInput,
): NativeQueryItem => {
  if (hasNativeQueryRelationshipName(query, input.name)) {
    throw new Error('Relationship names must be unique.');
  }

  const relationship = toRelationship(input);
  return input.kind === 'object'
    ? {
        ...query,
        object_relationships: [
          ...(query.object_relationships ?? []),
          relationship,
        ],
      }
    : {
        ...query,
        array_relationships: [
          ...(query.array_relationships ?? []),
          relationship,
        ],
      };
};

export const updateNativeQueryRelationship = (
  query: NativeQueryItem,
  originalName: string,
  input: NativeQueryRelationshipInput,
): NativeQueryItem => {
  if (hasNativeQueryRelationshipName(query, input.name, originalName)) {
    throw new Error('Relationship names must be unique.');
  }

  const relationship = toRelationship(input);
  const wasObject = query.object_relationships?.some(
    (item) => item.name === originalName,
  );
  const wasArray = query.array_relationships?.some(
    (item) => item.name === originalName,
  );

  if (!wasObject && !wasArray) {
    throw new Error('Relationship to update was not found.');
  }

  let objectRelationships = query.object_relationships?.filter(
    (item) => item.name !== originalName,
  );
  let arrayRelationships = query.array_relationships?.filter(
    (item) => item.name !== originalName,
  );

  if (input.kind === 'object') {
    if (wasObject) {
      objectRelationships = query.object_relationships?.map((item) =>
        item.name === originalName ? relationship : item,
      );
    } else {
      objectRelationships = [
        ...(query.object_relationships ?? []),
        relationship,
      ];
    }
  } else if (wasArray) {
    arrayRelationships = query.array_relationships?.map((item) =>
      item.name === originalName ? relationship : item,
    );
  } else {
    arrayRelationships = [...(query.array_relationships ?? []), relationship];
  }

  return {
    ...query,
    object_relationships: objectRelationships,
    array_relationships: arrayRelationships,
  };
};

export const removeNativeQueryRelationship = (
  query: NativeQueryItem,
  name: string,
): NativeQueryItem => ({
  ...query,
  object_relationships: query.object_relationships?.filter(
    (relationship) => relationship.name !== name,
  ),
  array_relationships: query.array_relationships?.filter(
    (relationship) => relationship.name !== name,
  ),
});
