import { useTheme } from '@mui/material';
import { buildClientSchema, buildSchema, type GraphQLSchema } from 'graphql';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useDialog } from '@/components/common/DialogProvider';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { useAddRemoteSchemaPermissionsMutation } from '@/features/orgs/projects/remote-schemas/hooks/useAddRemoteSchemaPermissionsMutation';
import { useIntrospectRemoteSchemaQuery } from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery';
import { useRemoveRemoteSchemaPermissionsMutation } from '@/features/orgs/projects/remote-schemas/hooks/useRemoveRemoteSchemaPermissionsMutation';
import { useUpdateRemoteSchemaPermissionsMutation } from '@/features/orgs/projects/remote-schemas/hooks/useUpdateRemoteSchemaPermissionsMutation';
import type { DialogFormProps } from '@/types/common';

// Types matching Hasura's approach
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
}

interface RemoteSchemaFields {
  name: string;
  typeName: string;
  children: CustomFieldType[];
}

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
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [remoteSchemaFields, setRemoteSchemaFields] = useState<
    RemoteSchemaFields[]
  >([]);

  const [schemaDefinition, setSchemaDefinition] = useState('');

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

  // Build RemoteSchemaFields structure from introspection (matching Hasura's getTree function)
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
        }));

        remoteFields.push({
          name: `type ${subscriptionType.name}`,
          typeName: '__subscription_root',
          children,
        });
      }

      return remoteFields;
    },
    [],
  );

  // Generate SDL from RemoteSchemaFields (inspired by Hasura's generateSDL function)
  const generateSDL = useCallback((fields: RemoteSchemaFields[]): string => {
    const lines: string[] = [];
    let hasQuery = false;
    let hasMutation = false;
    let hasSubscription = false;

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
          lines.push(`  ${field.name}`);
        });
        lines.push('}');
      } else if (schemaType.typeName === '__mutation_root') {
        hasMutation = true;
        lines.push('type Mutation {');
        checkedChildren.forEach((field) => {
          lines.push(`  ${field.name}`);
        });
        lines.push('}');
      } else if (schemaType.typeName === '__subscription_root') {
        hasSubscription = true;
        lines.push('type Subscription {');
        checkedChildren.forEach((field) => {
          lines.push(`  ${field.name}`);
        });
        lines.push('}');
      }
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
  }, []);

  // Build fields when schema is loaded
  useEffect(() => {
    if (introspectionData?.data) {
      try {
        const introspectionSchema = buildClientSchema(
          introspectionData.data as any,
        );

        let permissionSchema: GraphQLSchema | null = null;
        if (permission?.definition?.schema) {
          try {
            permissionSchema = buildSchema(permission.definition.schema);
          } catch (e) {
            console.error('Error building permission schema:', e);
          }
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
          const sdl = generateSDL(fields);
          setSchemaDefinition(sdl);
        }
      } catch (error) {
        console.error('Error building schema:', error);
      }
    }
  }, [introspectionData, permission, buildRemoteSchemaFields, generateSDL]);

  // Update schema definition when fields change
  useEffect(() => {
    if (remoteSchemaFields.length > 0) {
      const newSchemaDefinition = generateSDL(remoteSchemaFields);
      setSchemaDefinition(newSchemaDefinition);
    }
  }, [remoteSchemaFields, generateSDL]);

  // Handle field selection changes
  const handleFieldToggle = useCallback(
    (schemaTypeIndex: number, fieldIndex: number, checked: boolean) => {
      setRemoteSchemaFields((prev) => {
        const newFields = [...prev];
        newFields[schemaTypeIndex] = {
          ...newFields[schemaTypeIndex],
          children: newFields[schemaTypeIndex].children.map((child, index) =>
            index === fieldIndex ? { ...child, checked } : child,
          ),
        };
        return newFields;
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
    <Box
      className="flex flex-auto flex-col content-between overflow-hidden border-t-1"
      sx={{ backgroundColor: 'background.default' }}
    >
      <div className="flex-auto">
        <Box className="grid grid-flow-row content-start gap-6 overflow-y-auto border-b-1 p-6">
          {/* Header */}
          <div className="grid grid-flow-row gap-2">
            <Text component="h2" className="!font-bold">
              Edit Permissions: {remoteSchemaName} - {role}
            </Text>
            <Text>
              Select the fields and operations that should be available for this
              role.
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
          <Box className="space-y-4">
            <Text className="text-lg font-semibold">Available Fields</Text>
            <div className="max-h-96 space-y-4 overflow-y-auto rounded border p-4">
              {filteredFields.map((schemaType) => (
                <div key={schemaType.name} className="space-y-2">
                  <Text className="font-semibold text-blue-600">
                    {schemaType.name.replace('type ', '')} Operations
                  </Text>
                  <div className="space-y-1 pl-4">
                    {schemaType.children.map((field) => {
                      const fieldKey = `${schemaType.name}.${field.name}`;
                      const actualSchemaIndex = remoteSchemaFields.findIndex(
                        (f) => f.name === schemaType.name,
                      );
                      const actualFieldIndex = remoteSchemaFields[
                        actualSchemaIndex
                      ]?.children.findIndex((f) => f.name === field.name);

                      return (
                        <div
                          key={fieldKey}
                          className="flex items-center space-x-2"
                        >
                          <input
                            type="checkbox"
                            id={fieldKey}
                            checked={field.checked}
                            onChange={(e) =>
                              handleFieldToggle(
                                actualSchemaIndex,
                                actualFieldIndex,
                                e.target.checked,
                              )
                            }
                            className="form-checkbox h-4 w-4 text-blue-600"
                          />
                          <label
                            htmlFor={fieldKey}
                            className="flex-1 cursor-pointer"
                          >
                            <span className="font-medium">{field.name}</span>
                            <span className="ml-2 text-sm text-gray-500">
                              : {field.return}
                            </span>
                            {field.args && field.args.length > 0 && (
                              <span className="ml-2 text-xs text-gray-400">
                                ({field.args.length} arg
                                {field.args.length > 1 ? 's' : ''})
                              </span>
                            )}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {filteredFields.length === 0 && (
                <div className="py-8 text-center text-gray-500">
                  {searchTerm
                    ? 'No fields match your search'
                    : 'No fields available'}
                </div>
              )}
            </div>
          </Box>

          {/* Schema Definition Preview */}
          {schemaDefinition && (
            <Box className="space-y-4 rounded border-1 p-4">
              <Text className="text-lg font-semibold">
                Generated Schema Definition
              </Text>
              <pre
                className="max-h-40 overflow-auto whitespace-pre-wrap rounded p-4 text-sm"
                style={{
                  backgroundColor:
                    theme.palette.mode === 'dark' ? '#2d3748' : '#f7fafc',
                  color: theme.palette.mode === 'dark' ? '#e2e8f0' : '#2d3748',
                }}
              >
                {schemaDefinition}
              </pre>
            </Box>
          )}
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
  );
}
