import type { IntrospectRemoteSchemaResponse } from '@/utils/hasura-api/generated/schemas';
import { buildClientSchema, GraphQLSchema } from 'graphql';
import {
  AllowedRootFields,
  ComplexTreeData,
  GraphQLTypeForVisualization,
  HasuraRsFields,
  RelationshipFields,
} from './types';

export const convertIntrospectionToSchema = (
  introspectionData: IntrospectRemoteSchemaResponse,
): GraphQLSchema => {
  return buildClientSchema(introspectionData.data as any);
};

export const findRemoteField = (
  fields: RelationshipFields[],
  fieldKey: string,
): RelationshipFields | undefined => {
  return fields.find((f) => f.key === fieldKey);
};

export const getExpandedKeys = (
  relationshipFields: RelationshipFields[],
): string[] =>
  relationshipFields.filter((rf) => !rf.argValue).map((rf) => rf.key);

export const getCheckedKeys = (
  relationshipFields: RelationshipFields[],
): string[] =>
  relationshipFields.filter((rf) => rf.argValue).map((rf) => rf.key);

const isElementActive = (
  relationshipFields: RelationshipFields[],
  fieldKey: string,
): boolean => {
  return relationshipFields.some((f) => f.key === fieldKey);
};

const getUnderlyingType = (
  type: GraphQLTypeForVisualization,
): GraphQLTypeForVisualization => {
  let currentType = type;
  while (currentType.ofType) {
    currentType = currentType.ofType;
  }
  return currentType;
};

export const buildComplexTreeData = ({
  schema,
  relationshipFields,
  rootFields,
  fields,
  showOnlySelectable = false,
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
    const rootType = schema.getType(
      rootField === 'query'
        ? 'Query'
        : rootField === 'mutation'
          ? 'Mutation'
          : 'Subscription',
    );

    if (rootType && 'getFields' in rootType) {
      const rootFieldKey = `__${rootField}`;

      treeData[rootFieldKey] = {
        index: rootFieldKey,
        canMove: false,
        isFolder: true,
        children: [],
        data: rootField.charAt(0).toUpperCase() + rootField.slice(1),
        canRename: false,
      };

      treeData.root.children!.push(rootFieldKey);

      // Add fields of root type
      const typeFields = (rootType as any).getFields();
      Object.values(typeFields).forEach((field: any) => {
        const fieldKey = `${rootFieldKey}.field.${field.name}`;
        const hasArgs = field.args && field.args.length > 0;
        const hasNestedFields = isObjectTypeWithFields(field.type);
        const fieldType = getFieldTypeString(field.type);
        const fieldLabel = `${field.name}: ${fieldType}`;

        treeData[fieldKey] = {
          index: fieldKey,
          canMove: false,
          isFolder: hasArgs || hasNestedFields,
          children: hasArgs || hasNestedFields ? [] : undefined,
          data: fieldLabel,
          canRename: false,
        };

        treeData[rootFieldKey].children!.push(fieldKey);

        // Add arguments if present
        if (hasArgs) {
          field.args.forEach((arg: any) => {
            const argKey = `${fieldKey}.arg.${arg.name}`;
            const argType = getFieldTypeString(arg.type);
            treeData[argKey] = {
              index: argKey,
              canMove: false,
              isFolder: false,
              data: `${arg.name}: ${argType}`,
              canRename: false,
            };
            treeData[fieldKey].children!.push(argKey);
          });
        }

        // Add nested fields if present
        if (hasNestedFields && !hasArgs) {
          buildNestedFields(field.type, fieldKey, treeData, 1);
        }
      });
    }
  });

  return treeData;
};

const isObjectTypeWithFields = (type: any): boolean => {
  const underlyingType = getUnderlyingGraphQLType(type);
  return underlyingType && typeof underlyingType.getFields === 'function';
};

const getUnderlyingGraphQLType = (type: any): any => {
  let currentType = type;
  while (currentType.ofType) {
    currentType = currentType.ofType;
  }
  return currentType;
};

const buildNestedFields = (
  type: any,
  parentKey: string,
  treeData: ComplexTreeData,
  depth: number,
): void => {
  const underlyingType = getUnderlyingGraphQLType(type);

  if (underlyingType && typeof underlyingType.getFields === 'function') {
    const fields = underlyingType.getFields();
    Object.values(fields).forEach((field: any) => {
      const fieldKey = `${parentKey}.field.${field.name}`;
      const hasNestedFields = isObjectTypeWithFields(field.type);
      const fieldType = getFieldTypeString(field.type);

      // Include type information in the searchable data
      const fieldLabel = `${field.name}: ${fieldType}`;

      treeData[fieldKey] = {
        index: fieldKey,
        canMove: false,
        isFolder: hasNestedFields,
        children: hasNestedFields ? [] : undefined,
        data: fieldLabel,
        canRename: false,
      };

      if (!treeData[parentKey].children) {
        treeData[parentKey].children = [];
      }
      treeData[parentKey].children!.push(fieldKey);

      // Add arguments if present
      if (field.args && field.args.length > 0) {
        field.args.forEach((arg: any) => {
          const argKey = `${fieldKey}.arg.${arg.name}`;
          const argType = getFieldTypeString(arg.type);
          treeData[argKey] = {
            index: argKey,
            canMove: false,
            isFolder: false,
            data: `${arg.name}: ${argType}`,
            canRename: false,
          };
          if (!treeData[fieldKey].children) {
            treeData[fieldKey].children = [];
          }
          treeData[fieldKey].children!.push(argKey);
        });
      }

      // Limit depth to prevent infinite recursion
      if (depth < 3 && hasNestedFields) {
        buildNestedFields(field.type, fieldKey, treeData, depth + 1);
      }
    });
  }
};

// Helper function to get a readable type string
const getFieldTypeString = (type: any): string => {
  if (!type) return 'Unknown';

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
