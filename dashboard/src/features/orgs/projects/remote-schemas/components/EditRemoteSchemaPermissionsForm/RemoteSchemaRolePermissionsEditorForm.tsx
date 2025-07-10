import { zodResolver } from '@hookform/resolvers/zod';
import {
  type ArgumentNode,
  buildClientSchema,
  buildSchema,
  type DocumentNode,
  type FieldDefinitionNode,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLScalarType,
  type GraphQLSchema,
  GraphQLUnionType,
  type InputValueDefinitionNode,
  type ObjectFieldNode,
  type ObjectTypeDefinitionNode,
  parse,
} from 'graphql';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useDialog } from '@/components/common/DialogProvider';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Form } from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';
import { useAddRemoteSchemaPermissionsMutation } from '@/features/orgs/projects/remote-schemas/hooks/useAddRemoteSchemaPermissionsMutation';
import { useIntrospectRemoteSchemaQuery } from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery';
import { useRemoveRemoteSchemaPermissionsMutation } from '@/features/orgs/projects/remote-schemas/hooks/useRemoveRemoteSchemaPermissionsMutation';
import { useUpdateRemoteSchemaPermissionsMutation } from '@/features/orgs/projects/remote-schemas/hooks/useUpdateRemoteSchemaPermissionsMutation';
import type { DialogFormProps } from '@/types/common';

interface CustomFieldType {
  name: string;
  checked: boolean;
  args?: Array<{ name: string; type: string }>;
  return?: string;
  typeName?: string;
  children?: CustomFieldType[];
  defaultValue?: any;
  isInputObjectType?: boolean;
  parentName?: string;
  expanded?: boolean; // for UI expansion state
}

interface RemoteSchemaFields {
  name: string;
  typeName: string;
  children: CustomFieldType[];
}

// Argument tree type for storing preset values
type ArgTreeType = Record<string, any>;

// Form Schema for react-hook-form with Zod validation
const FormSchema = z.object({
  selectedFields: z.array(z.string()).optional().default([]),
  presetValues: z.any().optional().default({}),
});

type FormData = z.infer<typeof FormSchema>;

// Utility functions for handling presets
const addPresetDefinition = (schema: string): string => `scalar PresetValue
directive @preset(
    value: PresetValue
) on INPUT_FIELD_DEFINITION | ARGUMENT_DEFINITION

${schema}`;

const buildSchemaFromRoleDefn = (
  roleDefinition: string,
): GraphQLSchema | null => {
  try {
    const newDef = addPresetDefinition(roleDefinition);
    return buildSchema(newDef);
  } catch (err) {
    return null;
  }
};

// Parse preset values from SDL
const parseObjectField = (arg: ArgumentNode | ObjectFieldNode): any => {
  if (arg?.value?.kind === 'IntValue' && arg?.value?.value) {
    return arg?.value?.value;
  }
  if (arg?.value?.kind === 'FloatValue' && arg?.value?.value) {
    return arg?.value?.value;
  }
  if (arg?.value?.kind === 'StringValue' && arg?.value?.value) {
    return arg?.value?.value;
  }
  if (arg?.value?.kind === 'BooleanValue' && arg?.value?.value) {
    return arg?.value?.value;
  }
  if (arg?.value?.kind === 'EnumValue' && arg?.value?.value) {
    return arg?.value?.value;
  }
  if (arg?.value?.kind === 'NullValue') {
    return null;
  }

  // nested values
  if (
    arg?.value?.kind === 'ObjectValue' &&
    arg?.value?.fields &&
    arg?.value?.fields?.length > 0
  ) {
    const res: Record<string, any> = {};
    arg?.value?.fields.forEach((f: ObjectFieldNode) => {
      res[f.name.value] = parseObjectField(f);
    });
    return res;
  }

  return undefined;
};

const getDirectives = (field: InputValueDefinitionNode) => {
  let res: unknown | Record<string, any>;
  const preset = field?.directives?.find(
    (dir) => dir?.name?.value === 'preset',
  );
  if (preset?.arguments?.[0]) {
    res = parseObjectField(preset.arguments[0]);
  }
  if (typeof res === 'object') {
    return res;
  }
  if (typeof res === 'string') {
    try {
      return JSON.parse(res);
    } catch {
      return res;
    }
  }
  return res;
};

const getPresets = (field: FieldDefinitionNode) => {
  const res: Record<string, any> = {};
  field?.arguments?.forEach((arg) => {
    if (arg.directives && arg.directives.length > 0) {
      res[arg?.name?.value] = getDirectives(arg);
    }
  });
  return res;
};

const getFieldsMap = (fields: FieldDefinitionNode[], parentName: string) => {
  const type = `type ${parentName}`;
  const res: Record<string, any> = { [type]: {} };
  fields.forEach((field) => {
    res[type][field?.name?.value] = getPresets(field);
  });
  return res;
};

const getArgTreeFromPermissionSDL = (definition: string): ArgTreeType => {
  const roots = ['Query', 'Mutation', 'Subscription'];
  try {
    const schema: DocumentNode = parse(definition);
    const defs = schema.definitions as ObjectTypeDefinitionNode[];
    const argTree =
      defs?.reduce((acc: ArgTreeType, i: ObjectTypeDefinitionNode) => {
        if (i.name?.value && i.fields && roots.includes(i.name.value)) {
          const res = getFieldsMap(
            i.fields as FieldDefinitionNode[],
            i.name.value,
          );
          return { ...acc, ...res };
        }
        return acc;
      }, {}) || {};
    return argTree || {};
  } catch (e) {
    console.error(e);
    return {};
  }
};

// Format argument value for SDL
const formatArg = (value: any): string => {
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
};

// Check if type belongs to default GraphQL scalar types
const checkDefaultGQLScalarType = (typeName: string): boolean => {
  const gqlDefaultTypes = ['Boolean', 'Float', 'String', 'Int', 'ID'];
  return gqlDefaultTypes.includes(typeName);
};

// Extract base type name from GraphQL type string (remove !, [], etc.)
const getBaseTypeName = (typeString: string): string =>
  typeString.replace(/[[\]!]/g, '');

// Extract all referenced scalar types from fields
const extractReferencedScalars = (
  fields: RemoteSchemaFields[],
): Set<string> => {
  const referencedScalars = new Set<string>();

  fields.forEach((schemaType) => {
    schemaType.children.forEach((field) => {
      if (!field.checked) {
        return;
      }

      // Check return type
      if (field.return) {
        const baseReturnType = getBaseTypeName(field.return);
        if (
          !checkDefaultGQLScalarType(baseReturnType) &&
          !baseReturnType.match(/^(Query|Mutation|Subscription)$/)
        ) {
          // Check if this type is already explicitly defined and checked in our fields
          const hasExplicitDefinition = fields.some((f) => {
            if (f.name === `scalar ${baseReturnType}`) {
              return f.children.some((child) => child.checked);
            }
            return (
              f.typeName === baseReturnType ||
              f.name === `type ${baseReturnType}` ||
              f.name === `input ${baseReturnType}` ||
              f.name === `enum ${baseReturnType}` ||
              f.name === `union ${baseReturnType}` ||
              f.name === `interface ${baseReturnType}`
            );
          });

          if (!hasExplicitDefinition) {
            referencedScalars.add(baseReturnType);
          }
        }
      }

      // Check argument types
      if (field.args) {
        field.args.forEach((arg) => {
          const baseArgType = getBaseTypeName(arg.type);
          if (
            !checkDefaultGQLScalarType(baseArgType) &&
            !baseArgType.match(/^(Query|Mutation|Subscription)$/)
          ) {
            // Check if this type is already explicitly defined and checked in our fields
            const hasExplicitDefinition = fields.some((f) => {
              if (f.name === `scalar ${baseArgType}`) {
                return f.children.some((child) => child.checked);
              }
              return (
                f.typeName === baseArgType ||
                f.name === `type ${baseArgType}` ||
                f.name === `input ${baseArgType}` ||
                f.name === `enum ${baseArgType}` ||
                f.name === `union ${baseArgType}` ||
                f.name === `interface ${baseArgType}`
              );
            });

            if (!hasExplicitDefinition) {
              referencedScalars.add(baseArgType);
            }
          }
        });
      }
    });
  });

  return referencedScalars;
};

// Get schema roots (Query, Mutation, Subscription)
const getSchemaRoots = (schema: GraphQLSchema): string[] => {
  const roots: string[] = [];
  const queryType = schema.getQueryType();
  const mutationType = schema.getMutationType();
  const subscriptionType = schema.getSubscriptionType();

  if (queryType) {
    roots.push(queryType.name);
  }
  if (mutationType) {
    roots.push(mutationType.name);
  }
  if (subscriptionType) {
    roots.push(subscriptionType.name);
  }

  return roots;
};

// Get all type dependencies for a field recursively
const getTypeDependencies = (
  field: CustomFieldType,
  allTypes: RemoteSchemaFields[],
  visited: Set<string> = new Set(),
): string[] => {
  const dependencies: string[] = [];

  if (!field.return) {
    return dependencies;
  }

  const baseType = getBaseTypeName(field.return);

  // Skip built-in GraphQL types
  if (['String', 'Int', 'Float', 'Boolean', 'ID'].includes(baseType)) {
    return dependencies;
  }

  // Avoid circular dependencies
  if (visited.has(baseType)) {
    return dependencies;
  }

  visited.add(baseType);

  // Find the type in our schema
  const typeNames = [
    `type ${baseType}`,
    `input ${baseType}`,
    `enum ${baseType}`,
    `scalar ${baseType}`,
    `union ${baseType}`,
    `interface ${baseType}`,
  ];

  const foundType = allTypes.find((t) => typeNames.includes(t.name));

  if (foundType) {
    dependencies.push(foundType.name);

    // Recursively find dependencies of this type's fields
    foundType.children.forEach((childField) => {
      if (childField.return) {
        const childDeps = getTypeDependencies(childField, allTypes, visited);
        childDeps.forEach((dep) => {
          if (!dependencies.includes(dep)) {
            dependencies.push(dep);
          }
        });
      }
    });
  }

  return dependencies;
};

const buildCustomTypes = (
  introspectionSchema: GraphQLSchema,
  permissionsSchema: GraphQLSchema | null,
): RemoteSchemaFields[] => {
  const introspectionSchemaFields = introspectionSchema.getTypeMap();
  let permissionsSchemaFields: any = null;

  if (permissionsSchema !== null) {
    permissionsSchemaFields = permissionsSchema.getTypeMap();
  }

  const enumTypes: RemoteSchemaFields[] = [];
  const scalarTypes: RemoteSchemaFields[] = [];
  const inputObjectTypes: RemoteSchemaFields[] = [];
  const objectTypes: RemoteSchemaFields[] = [];
  const unionTypes: RemoteSchemaFields[] = [];
  const interfaceTypes: RemoteSchemaFields[] = [];

  const roots = getSchemaRoots(introspectionSchema);

  Object.entries(introspectionSchemaFields).forEach(([key, value]: any) => {
    if (
      !(
        value instanceof GraphQLObjectType ||
        value instanceof GraphQLInputObjectType ||
        value instanceof GraphQLEnumType ||
        value instanceof GraphQLScalarType ||
        value instanceof GraphQLUnionType ||
        value instanceof GraphQLInterfaceType
      )
    ) {
      return;
    }

    const { name } = value;

    // Skip root types and built-in types
    if (roots.includes(name) || name.startsWith('__')) {
      return;
    }

    const type: RemoteSchemaFields = {
      name: '',
      typeName: name,
      children: [],
    };

    if (value instanceof GraphQLEnumType) {
      type.name = `enum ${name}`;
      const values = value.getValues();
      const childArray: CustomFieldType[] = [];
      let checked = false;

      if (
        permissionsSchema !== null &&
        permissionsSchemaFields !== null &&
        key in permissionsSchemaFields
      ) {
        checked = true;
      }

      values.forEach((val) => {
        childArray.push({
          name: val.name,
          checked,
        });
      });

      type.children = childArray;
      enumTypes.push(type);
    } else if (value instanceof GraphQLScalarType) {
      type.name = `scalar ${name}`;
      let checked = false;

      if (
        permissionsSchema !== null &&
        permissionsSchemaFields !== null &&
        key in permissionsSchemaFields
      ) {
        checked = true;
      }

      const childArray: CustomFieldType[] = [{ name: type.name, checked }];
      type.children = childArray;
      scalarTypes.push(type);
    } else if (value instanceof GraphQLObjectType) {
      type.name = `type ${name}`;
      if (value.getInterfaces().length) {
        const implementsString = value
          .getInterfaces()
          .map((i: any) => i.name)
          .join(' & ');
        type.name = `type ${name} implements ${implementsString}`;
      }
    } else if (value instanceof GraphQLInputObjectType) {
      type.name = `input ${name}`;
    }

    if (
      value instanceof GraphQLObjectType ||
      value instanceof GraphQLInputObjectType
    ) {
      const childArray: CustomFieldType[] = [];
      const fieldVal = value.getFields();
      let permissionsFieldVal: any = {};
      let isFieldPresent = true;

      // Check if the type is present in the permission schema
      if (permissionsSchema !== null && permissionsSchemaFields !== null) {
        if (key in permissionsSchemaFields) {
          permissionsFieldVal = permissionsSchemaFields[key].getFields();
        } else {
          isFieldPresent = false;
        }
      }

      Object.entries(fieldVal).forEach(([k, v]: any) => {
        let checked = false;
        if (
          permissionsSchema !== null &&
          isFieldPresent &&
          k in permissionsFieldVal
        ) {
          checked = true;
        }

        const field: CustomFieldType = {
          name: v.name,
          checked,
          return: v.type.toString(),
          expanded: false,
        };

        if (v.defaultValue !== undefined) {
          field.defaultValue = v.defaultValue;
        }

        if (value instanceof GraphQLInputObjectType) {
          field.args = [{ name: k, type: v.type.toString() }];
          field.isInputObjectType = true;
          field.parentName = type.name;
        } else if (v.args?.length) {
          field.args = v.args.map((arg: any) => ({
            name: arg.name,
            type: arg.type.toString(),
          }));
        }

        childArray.push(field);
      });

      type.children = childArray;
      if (value instanceof GraphQLObjectType) {
        objectTypes.push(type);
      }
      if (value instanceof GraphQLInputObjectType) {
        inputObjectTypes.push(type);
      }
    }

    if (value instanceof GraphQLUnionType) {
      let isFieldPresent = true;
      let permissionsTypesVal: any;

      if (permissionsSchema !== null && permissionsSchemaFields !== null) {
        if (key in permissionsSchemaFields) {
          permissionsTypesVal = permissionsSchemaFields[key].getTypes();
        } else {
          isFieldPresent = false;
        }
      }

      type.name = `union ${name}`;
      const childArray: CustomFieldType[] = [];
      const typesVal = value.getTypes();

      typesVal.forEach((v: any, k: number) => {
        let checked = false;
        if (
          permissionsSchema !== null &&
          isFieldPresent &&
          permissionsTypesVal &&
          k < permissionsTypesVal.length
        ) {
          checked = true;
        }

        const field: CustomFieldType = {
          name: v.name,
          checked,
          return: v.name,
        };
        childArray.push(field);
      });

      type.children = childArray;
      unionTypes.push(type);
    }

    if (value instanceof GraphQLInterfaceType) {
      let isFieldPresent = true;
      let permissionsFieldVal: any = {};

      if (permissionsSchema !== null && permissionsSchemaFields !== null) {
        if (key in permissionsSchemaFields) {
          permissionsFieldVal = permissionsSchemaFields[key].getFields();
        } else {
          isFieldPresent = false;
        }
      }

      type.name = `interface ${name}`;
      const childArray: CustomFieldType[] = [];
      const fieldVal = value.getFields();

      Object.entries(fieldVal).forEach(([k, v]: any) => {
        let checked = false;
        if (
          permissionsSchema !== null &&
          isFieldPresent &&
          k in permissionsFieldVal
        ) {
          checked = true;
        }

        const field: CustomFieldType = {
          name: v.name,
          checked,
          return: v.type.toString(),
          expanded: false,
        };

        if (v.args?.length) {
          field.args = v.args.map((arg: any) => ({
            name: arg.name,
            type: arg.type.toString(),
          }));
        }

        childArray.push(field);
      });

      type.children = childArray;
      interfaceTypes.push(type);
    }
  });

  return [
    ...objectTypes,
    ...inputObjectTypes,
    ...unionTypes,
    ...enumTypes,
    ...scalarTypes,
    ...interfaceTypes,
  ];
};

export interface RemoteSchemaRolePermissionsEditorFormProps
  extends DialogFormProps {
  /**
   * The schema name of the remote schema that is being edited.
   */
  remoteSchemaName: string;
  /**
   * The role being edited.
   */
  role: string;
  /**
   * Existing permission for this role (if any).
   */
  permission?: any;
  /**
   * Function to be called when the operation is completed.
   */
  onSubmit: () => void;
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel: () => void;
}

export default function RemoteSchemaRolePermissionsEditorForm({
  remoteSchemaName,
  role,
  permission,
  onSubmit,
  onCancel,
}: RemoteSchemaRolePermissionsEditorFormProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [remoteSchemaFields, setRemoteSchemaFields] = useState<
    RemoteSchemaFields[]
  >([]);
  const [argTree, setArgTree] = useState<ArgTreeType>({}); // Store preset values
  const [schemaDefinition, setSchemaDefinition] = useState('');

  // Initialize form with react-hook-form
  const form = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      selectedFields: [],
      presetValues: {},
    },
  });

  // Fetch remote schema introspection
  const {
    data: introspectionData,
    isLoading: isLoadingSchema,
    error: schemaError,
  } = useIntrospectRemoteSchemaQuery(remoteSchemaName);

  // Mutations for managing permissions
  const addPermissionMutation = useAddRemoteSchemaPermissionsMutation();
  const { mutateAsync: updatePermission, isLoading: isUpdatingPermission } =
    useUpdateRemoteSchemaPermissionsMutation();
  const removePermissionMutation = useRemoveRemoteSchemaPermissionsMutation();

  const { openAlertDialog } = useDialog();

  const buildRemoteSchemaFields = useCallback(
    (
      introspectionSchema: GraphQLSchema,
      permissionsSchema: GraphQLSchema | null,
    ): RemoteSchemaFields[] => {
      const remoteFields: RemoteSchemaFields[] = [];

      // Build Query root
      const queryType = introspectionSchema.getQueryType();
      if (queryType) {
        const queryFields = queryType.getFields();
        const permissionQueryFields = permissionsSchema
          ?.getQueryType()
          ?.getFields();

        const children = Object.values(queryFields).map((field) => ({
          name: field.name,
          checked: !!(
            permissionQueryFields && field.name in permissionQueryFields
          ),
          args: field.args.map((arg) => ({
            name: arg.name,
            type: arg.type.toString(),
          })),
          return: field.type.toString(),
          parentName: `type ${queryType.name}`,
          expanded: false,
        }));

        remoteFields.push({
          name: `type ${queryType.name}`,
          typeName: '__query_root',
          children,
        });
      }

      // Build Mutation root
      const mutationType = introspectionSchema.getMutationType();
      if (mutationType) {
        const mutationFields = mutationType.getFields();
        const permissionMutationFields = permissionsSchema
          ?.getMutationType()
          ?.getFields();

        const children = Object.values(mutationFields).map((field) => ({
          name: field.name,
          checked: !!(
            permissionMutationFields && field.name in permissionMutationFields
          ),
          args: field.args.map((arg) => ({
            name: arg.name,
            type: arg.type.toString(),
          })),
          return: field.type.toString(),
          parentName: `type ${mutationType.name}`,
          expanded: false,
        }));

        remoteFields.push({
          name: `type ${mutationType.name}`,
          typeName: '__mutation_root',
          children,
        });
      }

      // Build Subscription root
      const subscriptionType = introspectionSchema.getSubscriptionType();
      if (subscriptionType) {
        const subscriptionFields = subscriptionType.getFields();
        const permissionSubscriptionFields = permissionsSchema
          ?.getSubscriptionType()
          ?.getFields();

        const children = Object.values(subscriptionFields).map((field) => ({
          name: field.name,
          checked: !!(
            permissionSubscriptionFields &&
            field.name in permissionSubscriptionFields
          ),
          args: field.args.map((arg) => ({
            name: arg.name,
            type: arg.type.toString(),
          })),
          return: field.type.toString(),
          parentName: `type ${subscriptionType.name}`,
          expanded: false,
        }));

        remoteFields.push({
          name: `type ${subscriptionType.name}`,
          typeName: '__subscription_root',
          children,
        });
      }

      const customTypes = buildCustomTypes(
        introspectionSchema,
        permissionsSchema,
      );

      return [...remoteFields, ...customTypes];
    },
    [],
  );

  // Generate SDL from RemoteSchemaFields with preset support
  const generateSDL = useCallback(
    (fields: RemoteSchemaFields[], argTreeData: ArgTreeType): string => {
      const lines: string[] = [];
      let hasQuery = false;
      let hasMutation = false;
      let hasSubscription = false;

      // Extract referenced scalars that need to be defined
      const referencedScalars = extractReferencedScalars(fields);

      fields.forEach((schemaType) => {
        const checkedChildren = schemaType.children.filter(
          (child) => child.checked,
        );
        if (checkedChildren.length === 0) {
          return;
        }

        if (schemaType.typeName === '__query_root') {
          hasQuery = true;
          lines.push('type Query {');
          checkedChildren.forEach((field) => {
            let fieldStr = `  ${field.name}`;

            // Add arguments with presets
            if (field.args && field.args.length > 0) {
              fieldStr += '(';
              const argStrs: string[] = [];

              field.args.forEach((arg) => {
                let argStr = `${arg.name} : ${arg.type}`;

                // Check for preset value
                const presetValue =
                  argTreeData?.[schemaType.name]?.[field.name]?.[arg.name];
                if (presetValue !== undefined) {
                  argStr += ` @preset(value: ${formatArg(presetValue)}) `;
                }

                argStrs.push(argStr);
              });

              fieldStr += `${argStrs.join(' ')})`;
            }

            fieldStr += ` : ${field.return}`;
            lines.push(fieldStr);
          });
          lines.push('}');
        } else if (schemaType.typeName === '__mutation_root') {
          hasMutation = true;
          lines.push('type Mutation {');
          checkedChildren.forEach((field) => {
            let fieldStr = `  ${field.name}`;

            // Add arguments with presets
            if (field.args && field.args.length > 0) {
              fieldStr += '(';
              const argStrs: string[] = [];

              field.args.forEach((arg) => {
                let argStr = `${arg.name} : ${arg.type}`;

                // Check for preset value
                const presetValue =
                  argTreeData?.[schemaType.name]?.[field.name]?.[arg.name];
                if (presetValue !== undefined) {
                  argStr += ` @preset(value: ${formatArg(presetValue)}) `;
                }

                argStrs.push(argStr);
              });

              fieldStr += `${argStrs.join(' ')})`;
            }

            fieldStr += ` : ${field.return}`;
            lines.push(fieldStr);
          });
          lines.push('}');
        } else if (schemaType.typeName === '__subscription_root') {
          hasSubscription = true;
          lines.push('type Subscription {');
          checkedChildren.forEach((field) => {
            let fieldStr = `  ${field.name}`;

            // Add arguments with presets
            if (field.args && field.args.length > 0) {
              fieldStr += '(';
              const argStrs: string[] = [];

              field.args.forEach((arg) => {
                let argStr = `${arg.name} : ${arg.type}`;

                // Check for preset value
                const presetValue =
                  argTreeData?.[schemaType.name]?.[field.name]?.[arg.name];
                if (presetValue !== undefined) {
                  argStr += ` @preset(value: ${formatArg(presetValue)}) `;
                }

                argStrs.push(argStr);
              });

              fieldStr += `${argStrs.join(' ')})`;
            }

            fieldStr += ` : ${field.return}`;
            lines.push(fieldStr);
          });
          lines.push('}');
        } else {
          // Handle custom types (object, input, enum, scalar, union, interface)
          const typeName = schemaType.name;

          // Skip default GraphQL scalar types
          if (
            typeName.startsWith('scalar') &&
            checkDefaultGQLScalarType(schemaType.typeName)
          ) {
            return;
          }

          if (typeName.startsWith('enum')) {
            lines.push(`${typeName} {`);
            checkedChildren.forEach((field) => {
              lines.push(`  ${field.name}`);
            });
            lines.push('}');
          } else if (typeName.startsWith('scalar')) {
            lines.push(typeName);
          } else if (typeName.startsWith('union')) {
            const typeNames = checkedChildren
              .map((child) => child.name)
              .join(' | ');
            lines.push(`${typeName} = ${typeNames}`);
          } else if (
            typeName.startsWith('type') ||
            typeName.startsWith('input') ||
            typeName.startsWith('interface')
          ) {
            lines.push(`${typeName} {`);
            checkedChildren.forEach((field) => {
              let fieldStr = `  ${field.name}`;

              // Add arguments with presets for object/interface types
              if (
                !typeName.startsWith('input') &&
                field.args &&
                field.args.length > 0
              ) {
                fieldStr += '(';
                const argStrs: string[] = [];

                field.args.forEach((arg) => {
                  let argStr = `${arg.name} : ${arg.type}`;

                  // Check for preset value
                  const presetValue =
                    argTreeData?.[schemaType.name]?.[field.name]?.[arg.name];
                  if (presetValue !== undefined) {
                    argStr += ` @preset(value: ${formatArg(presetValue)}) `;
                  }

                  argStrs.push(argStr);
                });

                fieldStr += `${argStrs.join(' ')})`;
              }

              if (field.return) {
                fieldStr += ` : ${field.return}`;
              }

              lines.push(fieldStr);
            });
            lines.push('}');
          }
        }
      });

      // Add any referenced scalar types that aren't already defined
      referencedScalars.forEach((scalarType) => {
        lines.push(`scalar ${scalarType}`);
      });

      // Add schema definition if needed
      if (hasQuery || hasMutation || hasSubscription) {
        const schemaDef = ['schema {'];
        if (hasQuery) {
          schemaDef.push('  query: Query');
        }
        if (hasMutation) {
          schemaDef.push('  mutation: Mutation');
        }
        if (hasSubscription) {
          schemaDef.push('  subscription: Subscription');
        }
        schemaDef.push('}');

        return `${schemaDef.join('\n')}\n\n${lines.join('\n')}`;
      }

      return lines.join('\n');
    },
    [],
  );

  // Build fields when schema is loaded
  useEffect(() => {
    if (introspectionData?.data) {
      try {
        const introspectionSchema = buildClientSchema(
          introspectionData.data as any,
        );

        let permissionSchema: GraphQLSchema | null = null;
        let newArgTree: ArgTreeType = {};

        if (permission?.definition?.schema) {
          // Use buildSchemaFromRoleDefn to handle @preset directives
          permissionSchema = buildSchemaFromRoleDefn(
            permission.definition.schema,
          );

          // Parse existing presets from the schema definition
          newArgTree = getArgTreeFromPermissionSDL(
            permission.definition.schema,
          );
          setArgTree(newArgTree);
        }

        const fields = buildRemoteSchemaFields(
          introspectionSchema,
          permissionSchema,
        );
        setRemoteSchemaFields(fields);

        // Generate SDL from the current state
        if (permissionSchema) {
          setSchemaDefinition(permission.definition.schema);
        } else {
          const sdl = generateSDL(fields, newArgTree);
          setSchemaDefinition(sdl);
        }
      } catch (error) {
        console.error('Error building schema:', error);
      }
    }
  }, [introspectionData, permission, buildRemoteSchemaFields, generateSDL]);

  // Update schema definition when fields or argTree change
  useEffect(() => {
    if (remoteSchemaFields.length > 0) {
      const newSchemaDefinition = generateSDL(remoteSchemaFields, argTree);
      setSchemaDefinition(newSchemaDefinition);
    }
  }, [remoteSchemaFields, argTree, generateSDL]);

  // Handle field selection changes with automatic dependency selection
  const handleFieldToggle = useCallback(
    (schemaTypeIndex: number, fieldIndex: number, checked: boolean) => {
      setRemoteSchemaFields((prev) => {
        const newFields = [...prev];
        const currentField = newFields[schemaTypeIndex].children[fieldIndex];

        // Update the current field
        newFields[schemaTypeIndex] = {
          ...newFields[schemaTypeIndex],
          children: newFields[schemaTypeIndex].children.map((child, index) =>
            index === fieldIndex ? { ...child, checked } : child,
          ),
        };

        // If checking a field, automatically check its dependencies
        if (checked && currentField.return) {
          const dependencies = getTypeDependencies(currentField, newFields);

          dependencies.forEach((depTypeName) => {
            const depTypeIndex = newFields.findIndex(
              (type) => type.name === depTypeName,
            );
            if (depTypeIndex !== -1) {
              // Mark all fields in the dependent type as checked
              newFields[depTypeIndex] = {
                ...newFields[depTypeIndex],
                children: newFields[depTypeIndex].children.map((child) => ({
                  ...child,
                  checked: true,
                })),
              };
            }
          });
        }

        // If unchecking a field, check if we need to uncheck dependencies
        if (!checked && currentField.return) {
          const dependencies = getTypeDependencies(currentField, newFields);

          dependencies.forEach((depTypeName) => {
            const depTypeIndex = newFields.findIndex(
              (type) => type.name === depTypeName,
            );
            if (depTypeIndex !== -1) {
              // Check if any other checked fields still depend on this type
              const stillNeeded = newFields.some((schemaType, typeIndex) => {
                if (typeIndex === schemaTypeIndex) {
                  return false; // Skip the current type
                }
                return schemaType.children.some((field, fIndex) => {
                  if (typeIndex === schemaTypeIndex && fIndex === fieldIndex) {
                    return false; // Skip current field
                  }
                  if (!field.checked || !field.return) {
                    return false;
                  }
                  const fieldDeps = getTypeDependencies(field, newFields);
                  return fieldDeps.includes(depTypeName);
                });
              });

              // If no other fields need this dependency, uncheck it
              if (!stillNeeded) {
                newFields[depTypeIndex] = {
                  ...newFields[depTypeIndex],
                  children: newFields[depTypeIndex].children.map((child) => ({
                    ...child,
                    checked: false,
                  })),
                };
              }
            }
          });
        }

        return newFields;
      });
    },
    [],
  );

  // Handle preset value changes
  const handlePresetChange = useCallback(
    (
      schemaTypeName: string,
      fieldName: string,
      argName: string,
      value: string,
    ) => {
      setArgTree((prev) => {
        const newArgTree = { ...prev };
        if (!newArgTree[schemaTypeName]) {
          newArgTree[schemaTypeName] = {};
        }
        if (!newArgTree[schemaTypeName][fieldName]) {
          newArgTree[schemaTypeName][fieldName] = {};
        }

        if (value.trim() === '') {
          // Remove preset if value is empty
          delete newArgTree[schemaTypeName][fieldName][argName];

          // Clean up empty objects
          if (Object.keys(newArgTree[schemaTypeName][fieldName]).length === 0) {
            delete newArgTree[schemaTypeName][fieldName];
          }
          if (Object.keys(newArgTree[schemaTypeName]).length === 0) {
            delete newArgTree[schemaTypeName];
          }
        } else {
          newArgTree[schemaTypeName][fieldName][argName] = value;
        }

        return newArgTree;
      });
    },
    [],
  );

  // Save permission
  const handleSavePermission = async () => {
    if (!schemaDefinition) {
      console.log('No schema definition to save');
      return;
    }

    try {
      if (permission) {
        await updatePermission({
          role,
          remoteSchema: remoteSchemaName,
          originalPermissionSchema: permission.definition.schema,
          newPermissionSchema: schemaDefinition,
        });
      } else {
        await addPermissionMutation.mutateAsync({
          args: {
            remote_schema: remoteSchemaName,
            role,
            definition: {
              schema: schemaDefinition,
            },
          },
        });
      }

      onSubmit();
    } catch (error) {
      console.error('Error saving permission:', error);
    }
  };

  // Remove permission
  const handleRemovePermission = async () => {
    if (!permission) {
      return;
    }

    try {
      await removePermissionMutation.mutateAsync({
        args: {
          remote_schema: remoteSchemaName,
          role,
          definition: {
            schema: permission.definition.schema,
          },
        },
      });

      onSubmit();
    } catch (error) {
      console.error('Error removing permission:', error);
    }
  };

  const handleDeleteClick = () => {
    openAlertDialog({
      title: 'Delete permissions',
      payload: (
        <span>
          Are you sure you want to delete the permissions for{' '}
          <strong>{role}</strong> on <strong>{remoteSchemaName}</strong>?
        </span>
      ),
      props: {
        primaryButtonText: 'Delete',
        primaryButtonColor: 'error',
        onPrimaryAction: handleRemovePermission,
      },
    });
  };

  // Filter fields based on search term
  const filteredFields = useMemo(() => {
    if (!searchTerm) {
      return remoteSchemaFields;
    }

    return remoteSchemaFields
      .map((schemaType) => ({
        ...schemaType,
        children: schemaType.children.filter(
          (field) =>
            field.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            field.return?.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      }))
      .filter((schemaType) => schemaType.children.length > 0);
  }, [remoteSchemaFields, searchTerm]);

  // Separate root types from custom types for better organization
  const rootTypes = useMemo(
    () =>
      filteredFields.filter(
        (field) =>
          field.typeName === '__query_root' ||
          field.typeName === '__mutation_root' ||
          field.typeName === '__subscription_root',
      ),
    [filteredFields],
  );

  const customTypes = useMemo(
    () =>
      filteredFields.filter(
        (field) =>
          field.typeName !== '__query_root' &&
          field.typeName !== '__mutation_root' &&
          field.typeName !== '__subscription_root' &&
          !field.name.startsWith('scalar') &&
          !field.name.startsWith('enum'),
      ),
    [filteredFields],
  );

  if (isLoadingSchema) {
    return (
      <div className="p-6">
        <ActivityIndicator label="Loading schema..." />
      </div>
    );
  }

  if (schemaError) {
    return (
      <div className="p-6">
        <Alert severity="error">
          Failed to load remote schema:{' '}
          {schemaError instanceof Error ? schemaError.message : 'Unknown error'}
        </Alert>
      </div>
    );
  }

  return (
    <Form {...form}>
      <Box
        className="flex flex-auto flex-col content-between border-t-1"
        sx={{
          backgroundColor: 'background.default',
          height: '92vh',
          maxHeight: '92vh',
        }}
      >
        <div className="flex flex-auto flex-col overflow-hidden">
          <Box className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              {/* Header */}
              <div className="grid grid-flow-row gap-2">
                <Text component="h2" className="!font-bold">
                  Edit Permissions: {remoteSchemaName} - {role}
                </Text>
                <Text>
                  Select the fields and operations that should be available for
                  this role. Expand fields to edit @preset values for arguments.
                </Text>
              </div>

              {/* Search */}
              <div className="relative">
                <Input
                  placeholder="Search fields and operations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-10"
                />
              </div>

              {/* Schema Fields */}
              <Box className="space-y-6">
                {/* Root Operations */}
                {rootTypes.length > 0 && (
                  <div className="space-y-4">
                    <Text className="text-lg font-semibold">
                      Root Operations
                    </Text>
                    <div className="space-y-4 rounded border p-4">
                      {rootTypes.map((schemaType) => (
                        <div key={schemaType.name} className="space-y-2">
                          <Text className="font-semibold text-blue-600">
                            {schemaType.name.replace('type ', '')} Operations
                          </Text>
                          <div className="pl-4">
                            <Accordion type="multiple" className="space-y-1">
                              {schemaType.children.map((field) => {
                                const fieldKey = `${schemaType.name}.${field.name}`;
                                const actualSchemaIndex =
                                  remoteSchemaFields.findIndex(
                                    (f) => f.name === schemaType.name,
                                  );
                                const actualFieldIndex = remoteSchemaFields[
                                  actualSchemaIndex
                                ]?.children.findIndex(
                                  (f) => f.name === field.name,
                                );

                                if (field.args && field.args.length > 0) {
                                  return (
                                    <AccordionItem
                                      key={fieldKey}
                                      value={fieldKey}
                                    >
                                      <AccordionTrigger className="py-2 hover:no-underline">
                                        <div className="flex items-center space-x-2">
                                          <Checkbox
                                            id={fieldKey}
                                            checked={field.checked}
                                            onCheckedChange={(checked) =>
                                              handleFieldToggle(
                                                actualSchemaIndex,
                                                actualFieldIndex,
                                                checked as boolean,
                                              )
                                            }
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                          <span className="font-medium">
                                            {field.name}
                                          </span>
                                          <span className="text-sm text-gray-500">
                                            : {field.return}
                                          </span>
                                          <span className="text-xs text-gray-400">
                                            ({field.args.length} arg
                                            {field.args.length > 1 ? 's' : ''})
                                          </span>
                                        </div>
                                      </AccordionTrigger>
                                      <AccordionContent>
                                        <div className="ml-6 space-y-2 border-l-2 border-gray-200 pl-4">
                                          <Text className="text-sm font-medium text-gray-700">
                                            Arguments:
                                          </Text>
                                          {field.args.map((arg) => {
                                            const presetValue =
                                              argTree?.[schemaType.name]?.[
                                                field.name
                                              ]?.[arg.name] || '';

                                            return (
                                              <div
                                                key={arg.name}
                                                className="flex items-center space-x-2"
                                              >
                                                <span className="min-w-0 flex-shrink-0 text-sm text-gray-600">
                                                  {arg.name}: {arg.type}
                                                </span>
                                                <Input
                                                  placeholder="@preset value"
                                                  value={presetValue}
                                                  onChange={(e) =>
                                                    handlePresetChange(
                                                      schemaType.name,
                                                      field.name,
                                                      arg.name,
                                                      e.target.value,
                                                    )
                                                  }
                                                  className="text-xs"
                                                />
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </AccordionContent>
                                    </AccordionItem>
                                  );
                                } else {
                                  return (
                                    <div
                                      key={fieldKey}
                                      className="flex items-center space-x-2 border-b py-2"
                                    >
                                      <Checkbox
                                        id={fieldKey}
                                        checked={field.checked}
                                        onCheckedChange={(checked) =>
                                          handleFieldToggle(
                                            actualSchemaIndex,
                                            actualFieldIndex,
                                            checked as boolean,
                                          )
                                        }
                                      />
                                      <label
                                        htmlFor={fieldKey}
                                        className="flex-1 cursor-pointer"
                                      >
                                        <span className="font-medium">
                                          {field.name}
                                        </span>
                                        <span className="ml-2 text-sm text-gray-500">
                                          : {field.return}
                                        </span>
                                      </label>
                                    </div>
                                  );
                                }
                              })}
                            </Accordion>
                          </div>
                        </div>
                      ))}

                      {rootTypes.length === 0 && (
                        <div className="py-8 text-center text-gray-500">
                          {searchTerm
                            ? 'No operations match your search'
                            : 'No operations available'}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Custom Types */}
                {customTypes.length > 0 && (
                  <div className="space-y-4">
                    <Text className="text-lg font-semibold">Custom Types</Text>
                    <div className="space-y-4 rounded border p-4">
                      {customTypes.map((schemaType) => (
                        <div key={schemaType.name} className="space-y-2">
                          <Text className="font-semibold text-green-600">
                            {schemaType.name}
                          </Text>
                          <div className="space-y-1 pl-4">
                            {schemaType.children.map((field) => {
                              const fieldKey = `${schemaType.name}.${field.name}`;
                              const actualSchemaIndex =
                                remoteSchemaFields.findIndex(
                                  (f) => f.name === schemaType.name,
                                );
                              const actualFieldIndex = remoteSchemaFields[
                                actualSchemaIndex
                              ]?.children.findIndex(
                                (f) => f.name === field.name,
                              );

                              return (
                                <div key={fieldKey} className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id={fieldKey}
                                      checked={field.checked}
                                      onCheckedChange={(checked) =>
                                        handleFieldToggle(
                                          actualSchemaIndex,
                                          actualFieldIndex,
                                          checked as boolean,
                                        )
                                      }
                                    />
                                    <label
                                      htmlFor={fieldKey}
                                      className="flex-1 cursor-pointer"
                                    >
                                      <span className="font-medium">
                                        {field.name}
                                      </span>
                                      {field.return && (
                                        <span className="ml-2 text-sm text-gray-500">
                                          : {field.return}
                                        </span>
                                      )}
                                      {field.args && field.args.length > 0 && (
                                        <span className="ml-2 text-xs text-gray-400">
                                          ({field.args.length} arg
                                          {field.args.length > 1 ? 's' : ''})
                                        </span>
                                      )}
                                    </label>
                                  </div>

                                  {/* Arguments section for custom types */}
                                  {field.expanded &&
                                    field.args &&
                                    field.args.length > 0 && (
                                      <div className="ml-6 space-y-2 border-l-2 border-gray-200 pl-4">
                                        <Text className="text-sm font-medium text-gray-700">
                                          Arguments:
                                        </Text>
                                        {field.args.map((arg) => {
                                          const presetValue =
                                            argTree?.[schemaType.name]?.[
                                              field.name
                                            ]?.[arg.name] || '';

                                          return (
                                            <div
                                              key={arg.name}
                                              className="flex items-center space-x-2"
                                            >
                                              <span className="min-w-0 flex-shrink-0 text-sm text-gray-600">
                                                {arg.name}: {arg.type}
                                              </span>
                                              <Input
                                                placeholder="@preset value"
                                                value={presetValue}
                                                onChange={(e) =>
                                                  handlePresetChange(
                                                    schemaType.name,
                                                    field.name,
                                                    arg.name,
                                                    e.target.value,
                                                  )
                                                }
                                                className="text-xs"
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {customTypes.length === 0 && !searchTerm && (
                        <div className="py-8 text-center text-gray-500">
                          No custom types found in schema
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* No results */}
                {filteredFields.length === 0 && (
                  <div className="space-y-4">
                    <Text className="text-lg font-semibold">
                      Available Fields
                    </Text>
                    <div className="rounded border p-8 text-center text-gray-500">
                      {searchTerm
                        ? 'No fields match your search'
                        : 'No fields available'}
                    </div>
                  </div>
                )}
              </Box>

              {/* Schema Definition Preview */}
              {/* {schemaDefinition && (
                <Box className="space-y-4 rounded border-1 p-4">
                  <Text className="text-lg font-semibold">
                    Generated Schema Definition
                  </Text>
                  <pre
                    className="max-h-40 overflow-auto whitespace-pre-wrap rounded p-4 text-sm"
                    style={{
                      backgroundColor:
                        theme.palette.mode === 'dark' ? '#2d3748' : '#f7fafc',
                      color:
                        theme.palette.mode === 'dark' ? '#e2e8f0' : '#2d3748',
                    }}
                  >
                    {schemaDefinition}
                  </pre>
                </Box>
              )} */}
            </div>
          </Box>
        </div>

        {/* Actions */}
        <Box className="grid flex-shrink-0 gap-2 border-t-1 p-2 sm:grid-flow-col sm:justify-between">
          <Button variant="borderless" color="secondary" onClick={onCancel}>
            Cancel
          </Button>

          <Box className="grid grid-flow-row gap-2 sm:grid-flow-col">
            {permission && (
              <Button
                variant="outlined"
                color="error"
                onClick={handleDeleteClick}
                disabled={removePermissionMutation.isLoading}
              >
                Delete Permissions
              </Button>
            )}

            <Button
              variant="contained"
              color="primary"
              onClick={handleSavePermission}
              disabled={
                !schemaDefinition ||
                addPermissionMutation.isLoading ||
                isUpdatingPermission
              }
            >
              Save Permissions
            </Button>
          </Box>
        </Box>
      </Box>
    </Form>
  );
}
