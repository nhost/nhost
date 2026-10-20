import type { GraphQLSchema } from 'graphql';
import { getArgumentNodes } from './schemaTreeItems';
import type { SchemaTreeNode } from './types';

export interface SchemaNodeDetails {
  node: SchemaTreeNode;
  kindLabel: string;
  /**
   * Description of the node's named type, e.g. of `users` for `users: [users!]!`.
   */
  typeDescription?: string | null;
  arguments: SchemaTreeNode[];
}

function getRootFieldLabel(schema: GraphQLSchema, ownerType?: string) {
  if (ownerType === schema.getMutationType()?.name) {
    return 'Mutation field';
  }

  if (ownerType === schema.getSubscriptionType()?.name) {
    return 'Subscription field';
  }

  return 'Query field';
}

function getKindLabel(schema: GraphQLSchema, node: SchemaTreeNode) {
  switch (node.kind) {
    case 'operation':
      return 'Operation';
    case 'field':
      return node.isRootField
        ? getRootFieldLabel(schema, node.ownerType)
        : 'Field';
    case 'argument':
      return 'Argument';
    case 'inputField':
      return 'Input field';
    case 'enumValue':
      return 'Enum value';
    case 'unionMember':
      return 'Union member';
    default:
      return '';
  }
}

/**
 * Collects what the details panel shows for a tree node.
 */
export default function getSchemaNodeDetails(
  schema: GraphQLSchema,
  node: SchemaTreeNode,
): SchemaNodeDetails {
  return {
    node,
    kindLabel: getKindLabel(schema, node),
    typeDescription: node.typeName
      ? schema.getType(node.typeName)?.description
      : undefined,
    arguments: getArgumentNodes(schema, node),
  };
}
