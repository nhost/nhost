import type {
  NativeQueryRelationshipFieldMapping,
  NativeQueryRelationshipInput,
} from '@/features/orgs/projects/database/native-queries/types';
import type {
  NativeQueryItem,
  NativeQueryRelationship,
} from '@/utils/hasura-api/generated/schemas';

export function fieldMappingsToColumnMapping(
  mappings: NativeQueryRelationshipFieldMapping[],
): Record<string, string> {
  return Object.fromEntries(
    mappings.map(({ sourceField, targetField }) => [sourceField, targetField]),
  );
}

export function columnMappingToFieldMappings(
  columnMapping: Record<string, string>,
): NativeQueryRelationshipFieldMapping[] {
  return Object.entries(columnMapping).map(([sourceField, targetField]) => ({
    sourceField,
    targetField,
  }));
}

function toRelationship(
  input: NativeQueryRelationshipInput,
): NativeQueryRelationship {
  return {
    name: input.name,
    using: {
      column_mapping: fieldMappingsToColumnMapping(input.fieldMappings),
      insertion_order: input.insertionOrder,
      remote_native_query: input.remoteNativeQuery,
    },
  };
}

export function hasNativeQueryRelationshipName(
  query: NativeQueryItem,
  name: string,
  ignoredName?: string,
): boolean {
  return [
    ...(query.object_relationships ?? []),
    ...(query.array_relationships ?? []),
  ].some(
    (relationship) =>
      relationship.name === name && relationship.name !== ignoredName,
  );
}

export function addNativeQueryRelationship(
  query: NativeQueryItem,
  input: NativeQueryRelationshipInput,
): NativeQueryItem {
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
}

function updateNativeQueryRelationship(
  query: NativeQueryItem,
  originalName: string,
  input: NativeQueryRelationshipInput,
): NativeQueryItem {
  if (hasNativeQueryRelationshipName(query, input.name, originalName)) {
    throw new Error('Relationship names must be unique.');
  }

  const objectRelationship = query.object_relationships?.find(
    (item) => item.name === originalName,
  );
  const arrayRelationship = query.array_relationships?.find(
    (item) => item.name === originalName,
  );
  const originalRelationship = objectRelationship ?? arrayRelationship;

  if (!originalRelationship) {
    throw new Error('Relationship to update was not found.');
  }

  const relationship: NativeQueryRelationship = {
    ...toRelationship(input),
    ...(originalRelationship.comment !== undefined && {
      comment: originalRelationship.comment,
    }),
  };
  const wasObject = Boolean(objectRelationship);
  const wasArray = Boolean(arrayRelationship);

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
}

export function removeNativeQueryRelationship(
  query: NativeQueryItem,
  name: string,
): NativeQueryItem {
  return {
    ...query,
    object_relationships: query.object_relationships?.filter(
      (relationship) => relationship.name !== name,
    ),
    array_relationships: query.array_relationships?.filter(
      (relationship) => relationship.name !== name,
    ),
  };
}

export default updateNativeQueryRelationship;
