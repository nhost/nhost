import highlightMatch from '@/features/orgs/utils/highlightMatch/highlightMatch';
import type { GraphQLSchema } from 'graphql';
import { HelpCircle } from 'lucide-react';
import React from 'react';
import type { ComplexTreeData, RelationshipFields } from './types';

export const ROOT_FIELDS = ['query', 'mutation', 'subscription'];

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

const createTreeItemData = (
  name: string,
  type: string,
  itemType: 'argument' | 'field' | 'root',
): React.ReactNode => {
  if (itemType === 'argument') {
    return `${name}: ${type}`;
  }
  if (itemType === 'field') {
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
  return `${name}`;
};

const getUnderlyingGraphQLType = (type: any): any => {
  let currentType = type;
  while (currentType.ofType) {
    currentType = currentType.ofType;
  }
  return currentType;
};

const getFieldTypeString = (type: any): string => {
  if (!type) {
    return 'Unknown';
  }

  if (typeof type.toString === 'function') {
    return type.toString();
  }

  if (type.name) {
    return type.name;
  }

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

      if (hasArgs) {
        field.args.forEach((arg: any) => {
          const argKey = `${fieldKey}.arg.${arg.name}`;
          const argType = getFieldTypeString(arg.type);
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

      if (depth < 3 && hasNestedFields) {
        buildNestedFields(field.type, fieldKey, treeData, depth + 1);
      }
    });
  }
};

export const buildComplexTreeData = ({
  schema,
}: {
  schema: GraphQLSchema;
}): ComplexTreeData => {
  const rootFields = ['query', 'mutation', 'subscription'];
  const treeData: ComplexTreeData = {};

  treeData.root = {
    index: 'root',
    canMove: false,
    isFolder: true,
    children: [],
    data: 'Schema',
    canRename: false,
  };

  rootFields.forEach((rootField) => {
    let rootType;
    if (rootField === 'query') {
      rootType = schema.getQueryType();
    } else if (rootField === 'mutation') {
      rootType = schema.getMutationType();
    } else {
      rootType = schema.getSubscriptionType();
    }

    if (rootType) {
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

      const typeFields = rootType.getFields();
      Object.values(typeFields).forEach((field: any) => {
        const fieldKey = `${rootFieldKey}.field.${field.name}`;
        const hasArgs = field.args && field.args.length > 0;
        const hasNestedFields = isObjectTypeWithFields(field.type);
        const fieldType = getFieldTypeString(field.type);
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

        if (hasArgs) {
          field.args.forEach((arg: any) => {
            const argKey = `${fieldKey}.arg.${arg.name}`;
            const argType = getFieldTypeString(arg.type);
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

        if (hasNestedFields) {
          buildNestedFields(field.type, fieldKey, treeData, 1);
        }
      });
    }
  });

  return treeData;
};

export const getText = (data: any): string => {
  if (React.isValidElement<{ children?: React.ReactNode }>(data)) {
    const { children } = data.props;
    if (Array.isArray(children)) {
      return children.map(getText).join('');
    }
    if (children === undefined || children === null) {
      return '';
    }
    return getText(children);
  }
  if (typeof data === 'string' || typeof data === 'number') {
    return String(data);
  }
  return String(data);
};

export const highlightNode = (
  node: React.ReactNode,
  term?: string,
): React.ReactNode => {
  const search = term?.trim();
  if (!search) {
    return node;
  }

  if (typeof node === 'string' || typeof node === 'number') {
    const text = String(node);
    return highlightMatch(text, search);
  }

  if (Array.isArray(node)) {
    return React.Children.map(node as React.ReactNode[], (child) =>
      highlightNode(child, search),
    );
  }

  if (React.isValidElement(node)) {
    const childProps: any = {};
    if (node.props && 'children' in node.props) {
      childProps.children = highlightNode(node.props.children, search);
    }
    return React.cloneElement(node, childProps);
  }

  return node;
};
