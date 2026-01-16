import type { GraphQLObjectType, GraphQLSchema } from 'graphql';
import { HelpCircle } from 'lucide-react';
import {
  Children,
  cloneElement,
  createElement,
  isValidElement,
  type ReactNode,
} from 'react';
import highlightMatch from '@/features/orgs/utils/highlightMatch/highlightMatch';
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
): ReactNode => {
  if (itemType === 'argument') {
    return `${name}: ${type}`;
  }
  if (itemType === 'field') {
    return createElement(
      'div',
      {
        className: 'flex items-center gap-1',
        style: { color: '#6b7280' }, // Gray-500 color
      },
      [
        createElement(HelpCircle, {
          key: 'icon',
          size: 12,
          className: 'text-gray-400',
        }),
        createElement('span', { key: 'text' }, `${name}: ${type}`),
      ],
    );
  }
  return `${name}`;
};

// biome-ignore lint/suspicious/noExplicitAny: TODO
const getUnderlyingGraphQLType = (type: any): any => {
  let currentType = type;
  while (currentType.ofType) {
    currentType = currentType.ofType;
  }
  return currentType;
};

const getFieldTypeString = (type: unknown): string => {
  if (!type) {
    return 'Unknown';
  }

  if (typeof type.toString === 'function') {
    return type.toString();
  }

  if ((type as { name: string }).name) {
    return (type as { name: string }).name;
  }

  return 'Unknown';
};

// biome-ignore lint/suspicious/noExplicitAny: TODO
const isObjectTypeWithFields = (type: any): boolean => {
  const underlyingType = getUnderlyingGraphQLType(type);
  return underlyingType && typeof underlyingType.getFields === 'function';
};

const buildNestedFields = (
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  type: any,
  parentKey: string,
  treeData: ComplexTreeData,
  depth: number,
): void => {
  const tree = treeData;
  const underlyingType = getUnderlyingGraphQLType(type);

  if (underlyingType && typeof underlyingType.getFields === 'function') {
    const fields = underlyingType.getFields();
    // biome-ignore lint/suspicious/noExplicitAny: TODO
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
        // biome-ignore lint/suspicious/noExplicitAny: TODO
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
    // biome-ignore lint/suspicious/noExplicitAny: TODO
    let rootType: GraphQLObjectType<any, any>;
    if (rootField === 'query') {
      rootType = schema.getQueryType()!;
    } else if (rootField === 'mutation') {
      rootType = schema.getMutationType()!;
    } else {
      rootType = schema.getSubscriptionType()!;
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
      // biome-ignore lint/suspicious/noExplicitAny: TODO
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
          // biome-ignore lint/suspicious/noExplicitAny: TODO
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

export const highlightNode = (node: ReactNode, term?: string): ReactNode => {
  const search = term?.trim();
  if (!search) {
    return node;
  }

  if (typeof node === 'string' || typeof node === 'number') {
    const text = String(node);
    return highlightMatch(text, search);
  }

  if (Array.isArray(node)) {
    return Children.map(node as ReactNode[], (child) =>
      highlightNode(child, search),
    );
  }

  if (isValidElement<Record<string, unknown>>(node)) {
    // biome-ignore lint/suspicious/noExplicitAny: TODO
    const childProps: any = {};
    if ('children' in node.props) {
      childProps.children = highlightNode(
        node.props.children as ReactNode,
        search,
      );
    }
    return cloneElement(node, childProps);
  }
  return node;
};
