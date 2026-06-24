import type {
  DefinitionNode,
  DocumentNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
} from 'graphql';
import { Kind, parse } from 'graphql';
import type { ClientCustomType } from '@/features/orgs/projects/graphql/actions/utils/customTypesUtils';
import {
  getAstTypeMetadata,
  wrapTypename,
} from '@/features/orgs/projects/graphql/actions/utils/graphqlTypeUtils';
import type { CustomTypeObjectField } from '@/utils/hasura-api/generated/schemas';

export interface ParseTypesSdlResult {
  types: ClientCustomType[];
  error: string | null;
}

function getDescription(node: {
  readonly description?: { readonly value: string };
}): { description: string } | Record<string, never> {
  const description = node.description?.value.trim();
  return description ? { description } : {};
}

function getFields(
  fieldNodes: ReadonlyArray<FieldDefinitionNode | InputValueDefinitionNode>,
): CustomTypeObjectField[] {
  return fieldNodes.map((fieldNode) => {
    const fieldTypeMetadata = getAstTypeMetadata(fieldNode.type);
    return {
      name: fieldNode.name.value,
      type: wrapTypename(fieldTypeMetadata.typename, fieldTypeMetadata.stack),
      ...getDescription(fieldNode),
    };
  });
}

function getTypeFromAstDefinition(
  definitionNode: DefinitionNode,
): { type: ClientCustomType; error: null } | { type: null; error: string } {
  switch (definitionNode.kind) {
    case Kind.SCALAR_TYPE_DEFINITION:
      return {
        type: {
          kind: 'scalar',
          name: definitionNode.name.value,
          ...getDescription(definitionNode),
        },
        error: null,
      };
    case Kind.ENUM_TYPE_DEFINITION:
      return {
        type: {
          kind: 'enum',
          name: definitionNode.name.value,
          ...getDescription(definitionNode),
          values: (definitionNode.values ?? []).map((valueNode) => ({
            value: valueNode.name.value,
            ...getDescription(valueNode),
          })),
        },
        error: null,
      };
    case Kind.OBJECT_TYPE_DEFINITION:
      return {
        type: {
          kind: 'object',
          name: definitionNode.name.value,
          ...getDescription(definitionNode),
          fields: getFields(definitionNode.fields ?? []),
        },
        error: null,
      };
    case Kind.INPUT_OBJECT_TYPE_DEFINITION:
      return {
        type: {
          kind: 'input_object',
          name: definitionNode.name.value,
          ...getDescription(definitionNode),
          fields: getFields(definitionNode.fields ?? []),
        },
        error: null,
      };
    case Kind.SCHEMA_DEFINITION:
      return {
        type: null,
        error: 'Schema definitions are not allowed in type definitions',
      };
    case Kind.INTERFACE_TYPE_DEFINITION:
      return { type: null, error: 'Interface types are not supported' };
    case Kind.UNION_TYPE_DEFINITION:
      return { type: null, error: 'Union types are not supported' };
    default:
      return {
        type: null,
        error:
          'Only scalar, enum, object, and input object types are supported',
      };
  }
}

export default function parseTypesSdl(sdl: string): ParseTypesSdlResult {
  if (!sdl || sdl.trim() === '') {
    return { types: [], error: null };
  }

  let documentAst: DocumentNode;
  try {
    documentAst = parse(sdl);
  } catch (error) {
    return {
      types: [],
      error: error instanceof Error ? error.message : 'Invalid SDL',
    };
  }

  const types: ClientCustomType[] = [];
  for (const definitionNode of documentAst.definitions) {
    const { type, error } = getTypeFromAstDefinition(definitionNode);
    if (error !== null) {
      return { types: [], error };
    }
    types.push(type);
  }

  return { types, error: null };
}
