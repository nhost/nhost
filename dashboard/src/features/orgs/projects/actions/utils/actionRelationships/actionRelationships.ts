import type { ClientCustomType } from '@/features/orgs/projects/actions/utils/customTypesUtils';
import {
  parseCustomTypes,
  reformCustomTypes,
} from '@/features/orgs/projects/actions/utils/customTypesUtils';
import { unwrapType } from '@/features/orgs/projects/actions/utils/graphqlTypeUtils';
import type {
  ActionItem,
  CustomTypes,
  ObjectTypeDefinitionRelationshipsItem,
} from '@/utils/hasura-api/generated/schemas';

export type ActionRelationshipType = 'object' | 'array';

/**
 * A relationship attached to an action's output object type. These live inside
 * `custom_types.objects[].relationships` and are managed via `set_custom_types`.
 */
export type ActionRelationship = {
  source: string;
  name: string;
  type: ActionRelationshipType;
  remote_table: { schema: string; name: string };
  field_mapping: Record<string, string>;
};

/**
 * Resolves the base (unwrapped) name of the type an action returns, e.g.
 * `[ExchangeRatesOutput!]!` -> `ExchangeRatesOutput`.
 */
export function getActionOutputTypeName(action: ActionItem): string {
  return unwrapType(action.definition.output_type).typename;
}

/**
 * Finds the object custom type an action returns. Returns `null` when the
 * output type is not an object type (e.g. a scalar), in which case
 * relationships cannot be attached.
 */
export function findOutputObjectType(
  customTypes: CustomTypes,
  outputTypeName: string,
): ClientCustomType | null {
  const outputType = parseCustomTypes(customTypes).find(
    (type) => type.kind === 'object' && type.name === outputTypeName,
  );

  return outputType ?? null;
}

export function getActionRelationships(
  outputObjectType: ClientCustomType | null,
): ActionRelationship[] {
  return (outputObjectType?.relationships ?? []) as ActionRelationship[];
}

/**
 * Produces a full `CustomTypes` payload for `set_custom_types` with the given
 * output type's relationships replaced. An empty list drops the `relationships`
 * key entirely (matching how the metadata API expects relationships removed).
 */
export function buildCustomTypesWithRelationships(
  customTypes: CustomTypes,
  outputTypeName: string,
  relationships: ActionRelationship[],
): CustomTypes {
  const updatedTypes = parseCustomTypes(customTypes).map((type) => {
    if (type.kind !== 'object' || type.name !== outputTypeName) {
      return type;
    }

    return {
      ...type,
      relationships:
        relationships.length > 0
          ? (relationships as ObjectTypeDefinitionRelationshipsItem[])
          : undefined,
    };
  });

  return reformCustomTypes(updatedTypes);
}
