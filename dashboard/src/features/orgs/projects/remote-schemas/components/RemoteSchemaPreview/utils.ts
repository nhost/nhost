import type { GraphQLSchema } from 'graphql';
import { HelpCircle } from 'lucide-react';
import React from 'react';
import type {
  AllowedRootFields,
  ComplexTreeData,
  HasuraRsFields,
  RelationshipFields,
} from './types';

export const getFieldData = (
  key: string,
  type: 'field' | 'arg',
  depth: number,
): RelationshipFields => ({
  key,
  depth,
  checkable: true,
  argValue: null,
  type,
});

// Helper function to create styled tree item data
const createTreeItemData = (
  name: string,
  type: string,
  itemType: 'argument' | 'field' | 'root',
): React.ReactNode => {
  if (itemType === 'argument') {
    // Arguments - normal styling
    return `${name}: ${type}`;
  }
  if (itemType === 'field') {
    // Sub-fields - grayer with arrow icon
    return React.createElement(
      'div',
      {
        className: 'flex items-center gap-1',
        style: { color: '#6b7280' }, // Gray-500 color
      },
      [
        React.createElement(HelpCircle, {
          key: 'icon',
          size: 12,
          className: 'text-gray-400',
        }),
        React.createElement('span', { key: 'text' }, `${name}: ${type}`),
      ],
    );
  }
  // Root items - normal styling
  return `${name}`;
};

const getUnderlyingGraphQLType = (type: any): any => {
  let currentType = type;
  while (currentType.ofType) {
    currentType = currentType.ofType;
  }
  return currentType;
};

// Helper function to get a readable type string (placed before first usage)
const getFieldTypeString = (type: any): string => {
  if (!type) {
    return 'Unknown';
  }

  // GraphQL.js types have a toString() method that properly formats them
  if (typeof type.toString === 'function') {
    return type.toString();
  }

  // Fallback: try to access the name property
  if (type.name) {
    return type.name;
  }

  // Last resort fallback
  return 'Unknown';
};

const isObjectTypeWithFields = (type: any): boolean => {
  const underlyingType = getUnderlyingGraphQLType(type);
  return underlyingType && typeof underlyingType.getFields === 'function';
};

const buildNestedFields = (
  type: any,
  parentKey: string,
  treeData: ComplexTreeData,
  depth: number,
): void => {
  const tree = treeData;
  const underlyingType = getUnderlyingGraphQLType(type);

  if (underlyingType && typeof underlyingType.getFields === 'function') {
    const fields = underlyingType.getFields();
    Object.values(fields).forEach((field: any) => {
      const fieldKey = `${parentKey}.field.${field.name}`;
      const hasArgs = field.args && field.args.length > 0;
      const hasNestedFields = isObjectTypeWithFields(field.type);
      const fieldType = getFieldTypeString(field.type);

      // Use styled data for sub-fields with visual indicator
      const fieldData = createTreeItemData(field.name, fieldType, 'field');

      tree[fieldKey] = {
        index: fieldKey,
        canMove: false,
        isFolder: hasArgs || hasNestedFields,
        children: hasArgs || hasNestedFields ? [] : undefined,
        data: fieldData,
        canRename: false,
      };

      if (!tree[parentKey].children) {
        tree[parentKey].children = [];
      }
      tree[parentKey].children!.push(fieldKey);

      // Add arguments if present
      if (hasArgs) {
        field.args.forEach((arg: any) => {
          const argKey = `${fieldKey}.arg.${arg.name}`;
          const argType = getFieldTypeString(arg.type);
          // Arguments use normal styling (no visual indicator)
          const argData = createTreeItemData(arg.name, argType, 'argument');

          tree[argKey] = {
            index: argKey,
            canMove: false,
            isFolder: false,
            data: argData,
            canRename: false,
          };
          if (!tree[fieldKey].children) {
            tree[fieldKey].children = [];
          }
          tree[fieldKey].children!.push(argKey);
        });
      }

      // Add nested fields if present (regardless of whether arguments exist)
      if (depth < 3 && hasNestedFields) {
        buildNestedFields(field.type, fieldKey, treeData, depth + 1);
      }
    });
  }
};

export const buildComplexTreeData = ({
  schema,
  rootFields,
}: {
  schema: GraphQLSchema;
  relationshipFields: RelationshipFields[];
  rootFields: AllowedRootFields;
  fields: HasuraRsFields;
  showOnlySelectable?: boolean;
}): ComplexTreeData => {
  const treeData: ComplexTreeData = {};

  // Add root item
  treeData.root = {
    index: 'root',
    canMove: false,
    isFolder: true,
    children: [],
    data: 'Schema',
    canRename: false,
  };

  // Add root fields (query, mutation, subscription)
  rootFields.forEach((rootField) => {
    const typeName = (
      {
        query: 'Query',
        mutation: 'Mutation',
        subscription: 'Subscription',
      } as const
    )[rootField];
    const rootType = schema.getType(typeName);

    if (rootType && 'getFields' in rootType) {
      const rootFieldKey = `__${rootField}`;

      const rootNode = {
        index: rootFieldKey,
        canMove: false,
        isFolder: true,
        children: [],
        data: rootField.charAt(0).toUpperCase() + rootField.slice(1),
        canRename: false,
      };
      treeData[rootFieldKey] = rootNode;
      treeData.root.children!.push(rootFieldKey);

      // Add fields of root type
      const typeFields = (rootType as any).getFields();
      Object.values(typeFields).forEach((field: any) => {
        const fieldKey = `${rootFieldKey}.field.${field.name}`;
        const hasArgs = field.args && field.args.length > 0;
        const hasNestedFields = isObjectTypeWithFields(field.type);
        const fieldType = getFieldTypeString(field.type);
        // Root level fields use normal styling (not sub-field styling)
        const fieldLabel = `${field.name}: ${fieldType}`;

        const node = {
          index: fieldKey,
          canMove: false,
          isFolder: hasArgs || hasNestedFields,
          children: hasArgs || hasNestedFields ? [] : undefined,
          data: fieldLabel,
          canRename: false,
        };
        treeData[fieldKey] = node;
        treeData[rootFieldKey].children!.push(fieldKey);

        // Add arguments if present
        if (hasArgs) {
          field.args.forEach((arg: any) => {
            const argKey = `${fieldKey}.arg.${arg.name}`;
            const argType = getFieldTypeString(arg.type);
            // Arguments for root level fields use normal styling
            const argData = createTreeItemData(arg.name, argType, 'argument');

            const argNode = {
              index: argKey,
              canMove: false,
              isFolder: false,
              data: argData,
              canRename: false,
            };
            treeData[argKey] = argNode;
            treeData[fieldKey].children!.push(argKey);
          });
        }

        // Add nested fields if present
        if (hasNestedFields) {
          buildNestedFields(field.type, fieldKey, treeData, 1);
        }
      });
    }
  });

  return treeData;
};
