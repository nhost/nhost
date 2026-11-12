import {
  astFromValue,
  type GraphQLArgument,
  type GraphQLField,
  type GraphQLInputField,
  type GraphQLObjectType,
  type GraphQLSchema,
  getNamedType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isUnionType,
  print,
} from 'graphql';
import type { SchemaTreeItems, SchemaTreeNode } from './types';

export const ROOT_ITEM_ID = 'root';

const OPERATIONS: {
  name: string;
  getType: (schema: GraphQLSchema) => GraphQLObjectType | null | undefined;
}[] = [
  { name: 'Query', getType: (schema) => schema.getQueryType() },
  { name: 'Mutation', getType: (schema) => schema.getMutationType() },
  { name: 'Subscription', getType: (schema) => schema.getSubscriptionType() },
];

function createFieldNode(
  field: GraphQLField<unknown, unknown>,
  ownerType: string,
): SchemaTreeNode {
  return {
    kind: 'field',
    name: field.name,
    typeLabel: field.type.toString(),
    typeName: getNamedType(field.type).name,
    ownerType,
    description: field.description,
    deprecationReason: field.deprecationReason,
  };
}

function printDefaultValue(value: GraphQLArgument | GraphQLInputField) {
  if (value.defaultValue === undefined) {
    return undefined;
  }

  const ast = astFromValue(value.defaultValue, value.type);

  return ast ? print(ast) : undefined;
}

function createInputValueNode(
  kind: 'argument' | 'inputField',
  value: GraphQLArgument | GraphQLInputField,
  ownerType: string,
): SchemaTreeNode {
  return {
    kind,
    name: value.name,
    typeLabel: value.type.toString(),
    typeName: getNamedType(value.type).name,
    ownerType,
    description: value.description,
    deprecationReason: value.deprecationReason,
    defaultValue: printDefaultValue(value),
  };
}

/**
 * Returns the operation nodes (Query, Mutation, Subscription) the schema has.
 */
export function getOperationNodes(schema: GraphQLSchema): SchemaTreeNode[] {
  return OPERATIONS.flatMap(({ name, getType }) => {
    const type = getType(schema);

    return type
      ? [{ kind: 'operation' as const, name, typeName: type.name }]
      : [];
  });
}

/**
 * Returns the arguments of a field node.
 */
export function getArgumentNodes(
  schema: GraphQLSchema,
  fieldNode: SchemaTreeNode,
): SchemaTreeNode[] {
  if (fieldNode.kind !== 'field' || !fieldNode.ownerType) {
    return [];
  }

  const ownerType = schema.getType(fieldNode.ownerType);

  if (!isObjectType(ownerType) && !isInterfaceType(ownerType)) {
    return [];
  }

  const field = ownerType.getFields()[fieldNode.name];

  return (field?.args ?? []).map((arg) =>
    createInputValueNode('argument', arg, fieldNode.ownerType!),
  );
}

/**
 * Returns the members of a named type: the fields of an object or interface,
 * the member types of a union, the input fields of an input object or the
 * values of an enum. Scalars have no members.
 */
export function getTypeMemberNodes(
  schema: GraphQLSchema,
  typeName: string,
): SchemaTreeNode[] {
  const type = schema.getType(typeName);

  if (isObjectType(type) || isInterfaceType(type)) {
    return Object.values(type.getFields()).map((field) =>
      createFieldNode(field, typeName),
    );
  }

  if (isUnionType(type)) {
    return type.getTypes().map((member) => ({
      kind: 'unionMember',
      name: member.name,
      typeName: member.name,
      ownerType: typeName,
    }));
  }

  if (isInputObjectType(type)) {
    return Object.values(type.getFields()).map((field) =>
      createInputValueNode('inputField', field, typeName),
    );
  }

  if (isEnumType(type)) {
    return type.getValues().map((value) => ({
      kind: 'enumValue',
      name: value.name,
      ownerType: typeName,
      description: value.description,
      deprecationReason: value.deprecationReason,
    }));
  }

  return [];
}

/**
 * Returns the children of a node: a field lists its arguments followed by the
 * members of its return type; every other node lists the members of its type.
 */
export function getNodeChildren(
  schema: GraphQLSchema,
  node: SchemaTreeNode,
): SchemaTreeNode[] {
  if (node.kind === 'root') {
    return getOperationNodes(schema);
  }

  const members = node.typeName
    ? getTypeMemberNodes(schema, node.typeName)
    : [];

  if (node.kind === 'operation') {
    return members.map((member) => ({ ...member, isRootField: true }));
  }

  if (node.kind === 'field') {
    return [...getArgumentNodes(schema, node), ...members];
  }

  return members;
}

function hasChildren(schema: GraphQLSchema, node: SchemaTreeNode): boolean {
  if (node.kind === 'root' || node.kind === 'operation') {
    return true;
  }

  if (node.kind === 'field' && getArgumentNodes(schema, node).length > 0) {
    return true;
  }

  const type = node.typeName ? schema.getType(node.typeName) : undefined;

  return (
    isObjectType(type) ||
    isInterfaceType(type) ||
    isUnionType(type) ||
    isInputObjectType(type) ||
    isEnumType(type)
  );
}

/**
 * Builds the id of a child item. Ids are paths from the root, so the same
 * field reached through different parents gets distinct items. GraphQL names
 * never contain `/`, `@`, `#` or `|`, so the prefixes keep siblings of
 * different kinds apart.
 */
export function getChildItemId(
  parentId: string,
  child: SchemaTreeNode,
): string {
  const prefixes: Partial<Record<SchemaTreeNode['kind'], string>> = {
    argument: '@',
    enumValue: '#',
    unionMember: '|',
  };
  const segment =
    child.kind === 'operation'
      ? child.name.toLowerCase()
      : `${prefixes[child.kind] ?? ''}${child.name}`;

  return parentId === ROOT_ITEM_ID ? segment : `${parentId}/${segment}`;
}

export function getNodeLabel(node: SchemaTreeNode): string {
  return node.typeLabel ? `${node.name}: ${node.typeLabel}` : node.name;
}

function createTreeItem(
  schema: GraphQLSchema,
  id: string,
  node: SchemaTreeNode,
) {
  const isFolder = hasChildren(schema, node);

  return {
    index: id,
    data: node,
    isFolder,
    children: isFolder ? [] : undefined,
    canMove: false,
    canRename: false,
  };
}

/**
 * Adds the children of an item, unless they were already added. Every folder
 * has at least one child, so an empty `children` list means "not built yet".
 */
export function expandTreeItem(
  schema: GraphQLSchema,
  items: SchemaTreeItems,
  itemId: string,
): SchemaTreeItems {
  const item = items[itemId];

  if (!item?.isFolder || (item.children?.length ?? 0) > 0) {
    return items;
  }

  const childItems = getNodeChildren(schema, item.data).map((child) =>
    createTreeItem(schema, getChildItemId(itemId, child), child),
  );

  return {
    ...items,
    ...Object.fromEntries(childItems.map((child) => [child.index, child])),
    [itemId]: { ...item, children: childItems.map((child) => child.index) },
  };
}

/**
 * Creates the root item with the schema's operations as its children.
 */
export function createRootItems(schema: GraphQLSchema): SchemaTreeItems {
  return expandTreeItem(
    schema,
    {
      [ROOT_ITEM_ID]: createTreeItem(schema, ROOT_ITEM_ID, {
        kind: 'root',
        name: 'Schema',
      }),
    },
    ROOT_ITEM_ID,
  );
}
