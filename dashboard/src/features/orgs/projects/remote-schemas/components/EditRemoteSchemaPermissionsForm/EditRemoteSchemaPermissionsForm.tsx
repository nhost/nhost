import { useState } from 'react';

import { useDialog } from '@/components/common/DialogProvider';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { FullPermissionIcon } from '@/components/ui/v2/icons/FullPermissionIcon';
import { NoPermissionIcon } from '@/components/ui/v2/icons/NoPermissionIcon';
import { PartialPermissionIcon } from '@/components/ui/v2/icons/PartialPermissionIcon';
import { Input } from '@/components/ui/v2/Input';
import { Link } from '@/components/ui/v2/Link';
import { Table } from '@/components/ui/v2/Table';
import { TableBody } from '@/components/ui/v2/TableBody';
import { TableCell } from '@/components/ui/v2/TableCell';
import { TableContainer } from '@/components/ui/v2/TableContainer';
import { TableHead } from '@/components/ui/v2/TableHead';
import { TableRow } from '@/components/ui/v2/TableRow';
import { Text } from '@/components/ui/v2/Text';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetRemoteSchemas } from '@/features/orgs/projects/remote-schemas/hooks/useGetRemoteSchemas';
import { useIntrospectRemoteSchemaQuery } from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery';
import type { RemoteSchemaAccessLevel } from '@/features/orgs/projects/remote-schemas/types';
import buildRemoteSchemaFieldTree from '@/features/orgs/projects/remote-schemas/utils/buildRemoteSchemaFieldTree';
import convertIntrospectionToSchema from '@/features/orgs/projects/remote-schemas/utils/convertIntrospectionToSchema';
import { createPermissionsSchema } from '@/features/orgs/projects/remote-schemas/utils/createPermissionsSchema';
import { findRemoteSchemaPermission } from '@/features/orgs/projects/remote-schemas/utils/findRemoteSchemaPermission';
import type { DialogFormProps } from '@/types/common';
import {
  useGetHasuraRemoteSchemaPermissionsEnabledQuery,
  useGetRemoteAppRolesQuery,
} from '@/utils/__generated__/graphql';
import NavLink from 'next/link';
import { twMerge } from 'tailwind-merge';
import RemoteSchemaRolePermissionsEditorForm from './RemoteSchemaRolePermissionsEditorForm';
import RolePermissionsRow from './RolePermissionsRow';

export interface EditRemoteSchemaPermissionsFormProps extends DialogFormProps {
  /**
   * The name of the remote schema to edit permissions for.
   */
  schema: string;
  /**
   * Function to be called when the form is cancelled.
   */
  onCancel?: () => void;
  /**
   * Whether the form is disabled.
   */
  disabled?: boolean;
}

export default function EditRemoteSchemaPermissionsForm({
  schema,
  disabled,
  onCancel,
  location,
  disabled,
}: EditRemoteSchemaPermissionsFormProps) {
  const [selectedRole, setSelectedRole] = useState<string>();
  const [isEditing, setIsEditing] = useState(false);

  const client = useRemoteApplicationGQLClient();
  const {
    data: rolesData,
    loading: rolesLoading,
    error: rolesError,
  } = useGetRemoteAppRolesQuery({ client });

  const { closeDrawerWithDirtyGuard } = useDialog();
  const { project } = useProject();
  const { org } = useCurrentOrg();
  const isPlatform = useIsPlatform();

  const localMimirClient = useLocalMimirClient();

  const { data: remoteSchemas, refetch: refetchRemoteSchemas } =
    useGetRemoteSchemas();

  const {
    data: remoteSchemaPermissionsEnabledData,
    loading: remoteSchemaPermissionsEnabledLoading,
  } = useGetHasuraRemoteSchemaPermissionsEnabledQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const remoteSchemaPermissionsEnabled = Boolean(
    remoteSchemaPermissionsEnabledData?.config?.hasura?.settings
      ?.enableRemoteSchemaPermissions,
  );

  const remoteSchema = remoteSchemas?.find((rs) => rs.name === schema);
  const remoteSchemaPermissions = remoteSchema?.permissions || [];

  const {
    data: introspectionData,
    error: introspectionError,
    isLoading: introspectionLoading,
  } = useIntrospectRemoteSchemaQuery(schema, {
    queryOptions: { enabled: !!schema },
  });

  if (
    !remoteSchemaPermissionsEnabled &&
    !remoteSchemaPermissionsEnabledLoading
  ) {
    return (
      <Box className="p-4">
        <Alert className="grid w-full grid-flow-col place-content-between items-center gap-2">
          <Text className="grid grid-flow-row justify-items-start gap-0.5">
            <Text component="span">
              To configure permissions, enable remote schema permissions first
              in{' '}
              <Link
                href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/hasura`}
                underline="hover"
              >
                Hasura Settings
              </Link>
              .
            </Text>
          </Text>
        </Alert>
      </Box>
    );
  }

  if (rolesLoading || introspectionLoading) {
    return (
      <div className="p-6">
        <ActivityIndicator label="Loading available roles..." />
      </div>
    );
  }

  if (introspectionError instanceof Error) {
    throw new Error(introspectionError.message);
  }

  if (rolesError) {
    throw rolesError;
  }

  const availableRoles = [
    'public',
    ...(rolesData?.authRoles?.map(({ role: authRole }) => authRole) || []),
  ];

  const graphqlSchema = introspectionData
    ? convertIntrospectionToSchema(introspectionData)
    : undefined;

  const getPermissionAccessLevel = (role: string): RemoteSchemaAccessLevel => {
    let permissionAccess: RemoteSchemaAccessLevel;
    if (role === 'admin') {
      permissionAccess = 'full';
    } else {
      const existingPerm = findRemoteSchemaPermission(
        remoteSchemaPermissions,
        role,
      );
      if (existingPerm) {
        if (!graphqlSchema) {
          permissionAccess = 'none';
        } else {
          const remoteFields = buildRemoteSchemaFieldTree(
            graphqlSchema,
            createPermissionsSchema(existingPerm?.definition.schema),
          );
          permissionAccess = 'full';

          if (
            remoteFields
              .filter(
                (field) =>
                  !field.name.startsWith('enum') &&
                  !field.name.startsWith('scalar'),
              )
              .some((field) =>
                field.children?.some((element) => element.checked === false),
              )
          ) {
            permissionAccess = 'partial';
          }
        }
      } else {
        permissionAccess = 'none';
      }
    }
    return permissionAccess;
  };

  if (isEditing && selectedRole) {
    const existingPermission = remoteSchemaPermissions.find(
      (p) => p.role === selectedRole,
    );

    return (
      <RemoteSchemaRolePermissionsEditorForm
        location={location}
        remoteSchemaName={schema}
        role={selectedRole}
        permission={existingPermission}
        disabled={disabled}
        onSubmit={async () => {
          await refetchRemoteSchemas();
          setIsEditing(false);
          setSelectedRole(undefined);
        }}
        onCancel={() => {
          setIsEditing(false);
          setSelectedRole(undefined);
        }}
      />
    );
  }

  // Fetch remote schema introspection
  const {
    data: introspectionData,
    isLoading: isLoadingSchema,
    error: schemaError,
  } = useIntrospectRemoteSchemaQuery(schema);

  // Mutations for managing permissions
  const addPermissionMutation = useAddRemoteSchemaPermissionsMutation();
  const updatePermissionMutation = useUpdateRemoteSchemaPermissionsMutation();
  const removePermissionMutation = useRemoveRemoteSchemaPermissionsMutation();

  const remoteSchemaPermissionsEnabled = Boolean(
    project?.config?.hasura?.settings?.enableRemoteSchemaPermissions,
  );

  // Get remote schema permissions from metadata
  const remoteSchema = remoteSchemas?.find((rs: any) => rs.name === schema);
  const remoteSchemaPermissions = remoteSchema?.permissions || [];

  // Build available fields from GraphQL schema
  const buildFieldsFromSchema = useCallback(
    (graphQLSchema: GraphQLSchema): SchemaType[] => {
      const schemaTypes: SchemaType[] = [];

      // Add query root
      const queryType = graphQLSchema.getQueryType();
      if (queryType) {
        const queryFields = queryType.getFields();
        const fields = Object.keys(queryFields).map((fieldName) => {
          const field = queryFields[fieldName];
          return {
            name: fieldName,
            type: field.type.toString(),
            args: field.args.map((arg) => ({
              name: arg.name,
              type: arg.type.toString(),
            })),
          };
        });

        schemaTypes.push({
          name: 'Query',
          fields,
        });
      }

      // Add mutation root if exists
      const mutationType = graphQLSchema.getMutationType();
      if (mutationType) {
        const mutationFields = mutationType.getFields();
        const fields = Object.keys(mutationFields).map((fieldName) => {
          const field = mutationFields[fieldName];
          return {
            name: fieldName,
            type: field.type.toString(),
            args: field.args.map((arg) => ({
              name: arg.name,
              type: arg.type.toString(),
            })),
          };
        });

        schemaTypes.push({
          name: 'Mutation',
          fields,
        });
      }

      // Add subscription root if exists
      const subscriptionType = graphQLSchema.getSubscriptionType();
      if (subscriptionType) {
        const subscriptionFields = subscriptionType.getFields();
        const fields = Object.keys(subscriptionFields).map((fieldName) => {
          const field = subscriptionFields[fieldName];
          return {
            name: fieldName,
            type: field.type.toString(),
            args: field.args.map((arg) => ({
              name: arg.name,
              type: arg.type.toString(),
            })),
          };
        });

        schemaTypes.push({
          name: 'Subscription',
          fields,
        });
      }

      return schemaTypes;
    },
    [],
  );

  // Generate SDL from selected fields (simplified version)
  const generateSDL = useCallback((fields: string[]): string => {
    if (fields.length === 0) return '';

    const lines: string[] = [];
    const queryFields: string[] = [];
    const mutationFields: string[] = [];
    const subscriptionFields: string[] = [];

    fields.forEach((field) => {
      if (field.startsWith('Query.')) {
        const fieldName = field.replace('Query.', '');
        queryFields.push(`  ${fieldName}`);
      } else if (field.startsWith('Mutation.')) {
        const fieldName = field.replace('Mutation.', '');
        mutationFields.push(`  ${fieldName}`);
      } else if (field.startsWith('Subscription.')) {
        const fieldName = field.replace('Subscription.', '');
        subscriptionFields.push(`  ${fieldName}`);
      }
    });

    if (queryFields.length > 0) {
      lines.push('type Query {');
      lines.push(...queryFields);
      lines.push('}');
    }

    if (mutationFields.length > 0) {
      lines.push('type Mutation {');
      lines.push(...mutationFields);
      lines.push('}');
    }

    if (subscriptionFields.length > 0) {
      lines.push('type Subscription {');
      lines.push(...subscriptionFields);
      lines.push('}');
    }

    return lines.join('\n');
  }, []);

  // Build fields when schema is loaded
  useEffect(() => {
    if (introspectionData?.data) {
      try {
        const graphQLSchema = buildClientSchema(introspectionData.data as any);
        const fields = buildFieldsFromSchema(graphQLSchema);
        setAvailableFields(fields);
      } catch (error) {
        console.error('Error building schema:', error);
      }
    }
  }, [introspectionData, buildFieldsFromSchema]);

  // Update schema definition when selected fields change
  useEffect(() => {
    const newSchemaDefinition = generateSDL(selectedFields);
    setSchemaDefinition(newSchemaDefinition);
  }, [selectedFields, generateSDL]);

  // Handle field selection changes
  const handleFieldToggle = useCallback(
    (fieldKey: string, checked: boolean) => {
      setSelectedFields((prev) => {
        if (checked) {
          return [...prev, fieldKey];
        }
        return prev.filter((key) => key !== fieldKey);
      });
    },
    [],
  );

  // Save permission
  const handleSavePermission = async () => {
    if (!selectedRole || !schemaDefinition) return;

    try {
      const existingPermission = remoteSchemaPermissions.find(
        (p: any) => p.role === selectedRole,
      );

      if (existingPermission) {
        await updatePermissionMutation.mutateAsync({
          role: selectedRole,
          remoteSchema: schema,
          originalPermissionSchema: existingPermission.definition.schema,
          newPermissionSchema: schemaDefinition,
        });
      } else {
        await addPermissionMutation.mutateAsync({
          args: {
            remote_schema: schema,
            role: selectedRole,
            definition: {
              schema: schemaDefinition,
            },
          },
        });
      }

      setIsEditing(false);
      setSelectedRole(undefined);
      setSchemaDefinition('');
      setSelectedFields([]);
    } catch (error) {
      console.error('Error saving permission:', error);
    }
  };

  // Remove permission
  const handleRemovePermission = async () => {
    if (!selectedRole) return;

    const existingPermission = remoteSchemaPermissions.find(
      (p: any) => p.role === selectedRole,
    );

    if (!existingPermission) return;

    try {
      await removePermissionMutation.mutateAsync({
        args: {
          remote_schema: schema,
          role: selectedRole,
          definition: {
            schema: existingPermission.definition.schema,
          },
        },
      });

      setIsEditing(false);
      setSelectedRole(undefined);
      setSchemaDefinition('');
      setSelectedFields([]);
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
          <strong>{selectedRole}</strong> on <strong>{schema}</strong>?
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
    if (!searchTerm) return availableFields;

    return availableFields
      .map((schemaType) => ({
        ...schemaType,
        fields: schemaType.fields.filter(
          (field) =>
            field.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            field.type.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      }))
      .filter((schemaType) => schemaType.fields.length > 0);
  }, [availableFields, searchTerm]);

  if (!remoteSchemaPermissionsEnabled) {
    return (
      <Box className="p-4">
        <Alert className="grid w-full grid-flow-col place-content-between items-center gap-2">
          <Text className="grid grid-flow-row justify-items-start gap-0.5">
            <Text component="span">
              To configure permissions, enable remote schema permissions first
              in{' '}
              <Link
                href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/hasura`}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
              >
                Hasura Settings
              </Link>
              .
            </Text>
          </Text>
        </Alert>
      </Box>
    );
  }

  if (rolesLoading || isLoadingSchema) {
    return (
      <div className="p-6">
        <ActivityIndicator
          label={
            rolesLoading ? 'Loading available roles...' : 'Loading schema...'
          }
        />
      </div>
    );
  }

  if (rolesError) {
    throw rolesError;
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

  const availableRoles = [
    'public',
    ...(rolesData?.authRoles?.map(({ role: authRole }) => authRole) || []),
  ];

  // Helper function to get permission access level for a role
  const getPermissionAccessLevel = (roleName: string) => {
    const permission = remoteSchemaPermissions.find(
      (p: any) => p.role === roleName,
    );
    return permission?.definition?.schema ? 'full' : 'none';
  };

  // If editing a specific role's permissions
  if (isEditing && selectedRole) {
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
                Edit Permissions: {schema} - {selectedRole}
              </Text>
              <Text>
                Select the fields and operations that should be available for
                this role.
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
                      {schemaType.name} Operations
                    </Text>
                    <div className="space-y-1 pl-4">
                      {schemaType.fields.map((field) => {
                        const fieldKey = `${schemaType.name}.${field.name}`;
                        return (
                          <div
                            key={fieldKey}
                            className="flex items-center space-x-2"
                          >
                            <input
                              type="checkbox"
                              id={fieldKey}
                              checked={selectedFields.includes(fieldKey)}
                              onChange={(e) =>
                                handleFieldToggle(fieldKey, e.target.checked)
                              }
                              className="form-checkbox h-4 w-4 text-blue-600"
                            />
                            <label
                              htmlFor={fieldKey}
                              className="flex-1 cursor-pointer"
                            >
                              <span className="font-medium">{field.name}</span>
                              <span className="ml-2 text-sm text-gray-500">
                                : {field.type}
                              </span>
                              {field.args.length > 0 && (
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
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-gray-100 p-4 text-sm">
                  {schemaDefinition}
                </pre>
              </Box>
            )}
          </Box>
        </div>

        {/* Actions */}
        <Box className="grid flex-shrink-0 gap-2 border-t-1 p-2 sm:grid-flow-col sm:justify-between">
          <Button
            variant="borderless"
            color="secondary"
            onClick={() => {
              setIsEditing(false);
              setSelectedRole(undefined);
              setSchemaDefinition('');
              setSelectedFields([]);
            }}
          >
            Cancel
          </Button>

          <Box className="grid grid-flow-row gap-2 sm:grid-flow-col">
            {getPermissionAccessLevel(selectedRole) !== 'none' && (
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
                updatePermissionMutation.isLoading
              }
            >
              Save Permissions
            </Button>
          </Box>
        </Box>
      </Box>
    );
  }

  // Role selection view
  return (
    <Box
      className="flex flex-auto flex-col content-between overflow-hidden border-t-1"
      sx={{ backgroundColor: 'background.default' }}
    >
      <div className="flex-auto">
        <Box className="grid grid-flow-row content-start gap-6 overflow-y-auto border-b-1 p-6">
          <div className="grid grid-flow-row gap-2">
            <Text component="h2" className="!font-bold">
              Remote Schema: {schema}
            </Text>

            <Text>
              Configure permissions for remote schema access. Rules for each
              role can be set by clicking on the corresponding cell.
            </Text>
          </div>

          <div className="grid grid-flow-col items-center justify-start gap-4">
            <Text
              variant="subtitle2"
              className="grid grid-flow-col items-center gap-1"
            >
              full access <FullPermissionIcon />
            </Text>

            <Text
              variant="subtitle2"
              className="grid grid-flow-col items-center gap-1"
            >
              partial access <PartialPermissionIcon />
            </Text>

            <Text
              variant="subtitle2"
              className="grid grid-flow-col items-center gap-1"
            >
              no access <NoPermissionIcon />
            </Text>
          </div>

          <TableContainer sx={{ backgroundColor: 'background.paper' }}>
            <Table>
              <TableHead className="block">
                <TableRow className="grid grid-cols-2 items-center">
                  <TableCell className="border-b-0 p-2">Role</TableCell>

                  <TableCell className="border-b-0 p-2 text-center">
                    Permission
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody className="block rounded-sm+ border-1">
                <RolePermissionsRow name="admin" disabled accessLevel="full" />

                {availableRoles.map((currentRole, index) => (
                  <RolePermissionsRow
                    name={currentRole}
                    key={currentRole}
                    className={twMerge(
                      index === availableRoles.length - 1 && 'border-b-0',
                    )}
                    onActionSelect={() => {
                      setSelectedRole(currentRole);
                      setIsEditing(true);
                    }}
                    accessLevel={getPermissionAccessLevel(currentRole)}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Alert className="text-left">
            Please go to the{' '}
            <NavLink
              href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/roles-and-permissions`}
              passHref
              legacyBehavior
            >
              <Link
                href="settings/roles-and-permissions"
                underline="hover"
                onClick={() => {}}
              >
                Settings page
              </Link>
            </NavLink>{' '}
            to add and delete roles.
          </Alert>
        </Box>
      </div>

      <Box className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 p-2">
        <Button variant="borderless" color="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
}
