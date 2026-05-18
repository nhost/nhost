import { zodResolver } from '@hookform/resolvers/zod';
import {
  buildClientSchema,
  type GraphQLArgument,
  type GraphQLSchema,
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
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getAllPermissionVariables } from '@/features/orgs/projects/permissions/settings/utils/getAllPermissionVariables';
import { useAddRemoteSchemaPermissionsMutation } from '@/features/orgs/projects/remote-schemas/hooks/useAddRemoteSchemaPermissionsMutation';
import { useIntrospectRemoteSchemaQuery } from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery';
import { useRemoveRemoteSchemaPermissionsMutation } from '@/features/orgs/projects/remote-schemas/hooks/useRemoveRemoteSchemaPermissionsMutation';
import { useUpdateRemoteSchemaPermissionsMutation } from '@/features/orgs/projects/remote-schemas/hooks/useUpdateRemoteSchemaPermissionsMutation';
import type {
  ArgLeafType,
  ArgTreeType,
  RemoteSchemaFields,
} from '@/features/orgs/projects/remote-schemas/types';
import buildRemoteSchemaFieldTree from '@/features/orgs/projects/remote-schemas/utils/buildRemoteSchemaFieldTree';
import composePermissionSDL from '@/features/orgs/projects/remote-schemas/utils/composePermissionSDL';
import {
  BUILT_IN_SCALARS,
  SDL_TYPE_KEYWORDS,
} from '@/features/orgs/projects/remote-schemas/utils/constants';
import { createPermissionsSchema } from '@/features/orgs/projects/remote-schemas/utils/createPermissionsSchema';
import getBaseTypeName from '@/features/orgs/projects/remote-schemas/utils/getBaseTypeName';
import parsePresetArgTreeFromSDL from '@/features/orgs/projects/remote-schemas/utils/parsePresetArgTreeFromSDL';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { isEmptyValue } from '@/lib/utils';
import type { DialogFormProps } from '@/types/common';
import { useGetRolesPermissionsQuery } from '@/utils/__generated__/graphql';
import type { RemoteSchemaInfoPermissionsItem } from '@/utils/hasura-api/generated/schemas';
import PresetValueInput from './PresetValueInput';

const rolePermissionsSchema = z.object({
  selectedFields: z.array(z.string()).optional().default([]),
  presetValues: z.any().optional().default({}),
});

type RolePermissionsFormValues = z.infer<typeof rolePermissionsSchema>;

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
  permission: RemoteSchemaInfoPermissionsItem;
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
  const [argTree, setArgTree] = useState<ArgTreeType>({});
  const [schemaDefinition, setSchemaDefinition] = useState('');
  const [openAccordionItems, setOpenAccordionItems] = useState<string[]>([]);

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { data: permissionVariablesData } = useGetRolesPermissionsQuery({
    variables: { appId: project?.id },
    skip: !project?.id,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });
  const customClaims =
    permissionVariablesData?.config?.auth?.session?.accessToken?.customClaims;
  const sessionVariableOptions = useMemo(
    () =>
      getAllPermissionVariables(customClaims).map(
        ({ key }) => `X-Hasura-${key}`,
      ),
    [customClaims],
  );

  const countVisible = useCallback(
    (list: RemoteSchemaFields[]) =>
      list.filter(
        (field) =>
          !['scalar', 'enum'].some((type) =>
            field?.name?.toLowerCase().includes(type),
          ),
      ).length,
    [],
  );

  const form = useForm<RolePermissionsFormValues>({
    resolver: zodResolver(rolePermissionsSchema),
    defaultValues: {
      selectedFields: [],
      presetValues: {},
    },
  });

  const {
    data: introspectionData,
    isLoading: isLoadingSchema,
    error: schemaError,
  } = useIntrospectRemoteSchemaQuery(remoteSchemaName);

  const { mutateAsync: addPermission, isPending: isAddingPermission } =
    useAddRemoteSchemaPermissionsMutation();
  const { mutateAsync: updatePermission, isPending: isUpdatingPermission } =
    useUpdateRemoteSchemaPermissionsMutation();
  const { mutateAsync: removePermission, isPending: isRemovingPermission } =
    useRemoveRemoteSchemaPermissionsMutation();

  const { openAlertDialog } = useDialog();

  useEffect(() => {
    if (introspectionData) {
      try {
        const introspectionSchema = buildClientSchema(introspectionData);

        let permissionSchema: GraphQLSchema | null = null;
        let newArgTree: ArgTreeType = {};

        if (permission?.definition?.schema) {
          permissionSchema = createPermissionsSchema(
            permission.definition.schema,
          );

          newArgTree = parsePresetArgTreeFromSDL(
            permission.definition.schema,
            introspectionSchema,
          );
          setArgTree(newArgTree);
        }

        const fields = buildRemoteSchemaFieldTree(
          introspectionSchema,
          permissionSchema,
        );
        setRemoteSchemaFields(fields);

        if (permissionSchema) {
          setSchemaDefinition(permission.definition.schema);
        } else {
          const sdl = composePermissionSDL(fields, newArgTree);
          setSchemaDefinition(sdl);
        }
      } catch (error) {
        console.error('Error building schema:', error);
      }
    }
  }, [introspectionData, permission]);

  useEffect(() => {
    if (remoteSchemaFields.length > 0) {
      const newSchemaDefinition = composePermissionSDL(
        remoteSchemaFields,
        argTree,
      );
      setSchemaDefinition(newSchemaDefinition);
    }
  }, [remoteSchemaFields, argTree]);

  const handleFieldToggle = useCallback(
    (schemaTypeIndex: number, fieldIndex: number, checked: boolean) => {
      setRemoteSchemaFields((prev) => {
        const newFields = [...prev];
        const schemaType = newFields[schemaTypeIndex];
        if (!schemaType?.children) {
          return prev;
        }
        if (fieldIndex < 0 || fieldIndex >= schemaType.children.length) {
          return prev;
        }
        const currentField = schemaType.children[fieldIndex];

        newFields[schemaTypeIndex] = {
          ...schemaType,
          children: (schemaType.children ?? []).map((child, index) =>
            index === fieldIndex ? { ...child, checked } : child,
          ),
        };

        if (checked && currentField.return) {
          const typesToCheck = new Set<string>();

          const returnBaseType = getBaseTypeName(currentField.return);
          if (!BUILT_IN_SCALARS.has(returnBaseType)) {
            typesToCheck.add(returnBaseType);
          }

          if (currentField.args) {
            Object.values(currentField.args).forEach((arg) => {
              const argBaseType = getBaseTypeName(arg.type.toString());
              if (argBaseType && !BUILT_IN_SCALARS.has(argBaseType)) {
                typesToCheck.add(argBaseType);
              }
            });
          }

          const checkTypeDependencies = (
            baseType: string,
            visited: Set<string> = new Set(),
          ) => {
            if (visited.has(baseType)) {
              return;
            }

            visited.add(baseType);

            const depTypeIndex = newFields.findIndex((type) => {
              const [keyword] = type.name.split(' ');
              return (
                SDL_TYPE_KEYWORDS.has(keyword) &&
                type.name === `${keyword} ${baseType}`
              );
            });

            if (depTypeIndex !== -1) {
              const hasUncheckedFields = (
                newFields[depTypeIndex].children ?? []
              ).some((child) => !child.checked);

              if (hasUncheckedFields) {
                newFields[depTypeIndex] = {
                  ...newFields[depTypeIndex],
                  children: newFields[depTypeIndex].children
                    ? newFields[depTypeIndex].children.map((child) => ({
                        ...child,
                        checked: true,
                      }))
                    : [],
                };

                newFields[depTypeIndex].children?.forEach((childField) => {
                  if (childField.return) {
                    const childBaseType = getBaseTypeName(childField.return);
                    if (!BUILT_IN_SCALARS.has(childBaseType)) {
                      checkTypeDependencies(childBaseType, visited);
                    }
                  }
                });
              }
            }
          };

          typesToCheck.forEach((baseType) => {
            checkTypeDependencies(baseType);
          });
        }

        return newFields;
      });
    },
    [],
  );

  const setPresetValue = useCallback(
    (
      schemaTypeName: string,
      fieldName: string,
      argName: string,
      value: ArgLeafType | undefined,
    ) => {
      setArgTree((prev) => {
        const fieldBucket = {
          ...((prev[schemaTypeName] as ArgTreeType | undefined)?.[fieldName] as
            | ArgTreeType
            | undefined),
        };
        if (value === undefined) {
          delete fieldBucket[argName];
        } else {
          fieldBucket[argName] = value;
        }

        const typeBucket = {
          ...(prev[schemaTypeName] as ArgTreeType | undefined),
        };
        if (isEmptyValue(fieldBucket)) {
          delete typeBucket[fieldName];
        } else {
          typeBucket[fieldName] = fieldBucket;
        }

        const next = { ...prev };
        if (isEmptyValue(typeBucket)) {
          delete next[schemaTypeName];
        } else {
          next[schemaTypeName] = typeBucket;
        }
        return next;
      });
    },
    [],
  );

  const renderPresetRow = useCallback(
    (schemaTypeName: string, fieldName: string, arg: GraphQLArgument) => {
      const rawValue = argTree?.[schemaTypeName]?.[fieldName]?.[arg.name];
      return (
        <PresetValueInput
          key={arg.name}
          arg={arg}
          rawValue={rawValue}
          sessionVariableOptions={sessionVariableOptions}
          onValueChange={(value) =>
            setPresetValue(schemaTypeName, fieldName, arg.name, value)
          }
        />
      );
    },
    [argTree, sessionVariableOptions, setPresetValue],
  );

  const handleSavePermission = async () => {
    if (!schemaDefinition) {
      return;
    }

    if (permission) {
      await execPromiseWithErrorToast(
        async () => {
          await updatePermission({
            role,
            remoteSchema: remoteSchemaName,
            originalPermissionSchema: permission.definition.schema,
            newPermissionSchema: schemaDefinition,
            resourceVersion,
          });

          onSubmit();
        },
        {
          loadingMessage: 'Updating permissions...',
          successMessage: 'Permissions updated successfully.',
          errorMessage:
            'An error occurred while updating permissions. Please try again.',
        },
      );
    } else {
      await execPromiseWithErrorToast(
        async () => {
          await addPermission({
            args: {
              remote_schema: remoteSchemaName,
              role,
              definition: {
                schema: schemaDefinition,
              },
            },
            resourceVersion,
          });

          onSubmit();
        },
        {
          loadingMessage: 'Adding permissions...',
          successMessage: 'Permissions added successfully.',
          errorMessage:
            'An error occurred while adding permissions. Please try again.',
        },
      );
    }
  };

  const handleRemovePermission = async () => {
    if (!permission) {
      return;
    }

    await execPromiseWithErrorToast(
      async () => {
        await removePermission({
          args: {
            remote_schema: remoteSchemaName,
            role,
            definition: {
              schema: permission.definition.schema,
            },
          },
          resourceVersion,
        });

        onSubmit();
      },
      {
        loadingMessage: 'Removing permissions...',
        successMessage: 'Permissions removed successfully.',
        errorMessage:
          'An error occurred while removing permissions. Please try again.',
      },
    );
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

  const filteredFields = useMemo(() => {
    if (!searchTerm) {
      return remoteSchemaFields;
    }

    return remoteSchemaFields
      .filter((field) => {
        if (
          ['scalar', 'enum'].some((type) =>
            field?.name?.toLowerCase().includes(type),
          )
        ) {
          return false;
        }

        if (searchTerm === '') {
          return true;
        }

        return (
          field?.name?.toLowerCase().includes(searchTerm?.toLowerCase()) ||
          field.children?.some((child) =>
            child?.name?.toLowerCase().includes(searchTerm?.toLowerCase()),
          )
        );
      })
      .map((schemaType) => ({
        ...schemaType,
        children: (schemaType.children ?? []).filter(
          (field) =>
            field.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            field.return?.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      }))
      .filter((schemaType) => schemaType.children.length > 0);
  }, [remoteSchemaFields, searchTerm]);

  const filteredTypesSet = useMemo(
    () => new Set(filteredFields.map((field) => field.name)),
    [filteredFields],
  );

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
              <div className="grid grid-flow-row gap-2">
                <Text component="h2" className="!font-bold">
                  Edit Permissions: {remoteSchemaName} - {role}
                </Text>
                <Text>
                  Select the fields and operations that should be available for
                  this role. Edit preset values for arguments when needed.
                </Text>
              </div>

              <div className="relative space-y-2">
                <Input
                  placeholder="Search fields and operations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-10"
                />
                {searchTerm && (
                  <div className="text-gray-500 text-sm">
                    {filteredTypesSet.size} out of{' '}
                    {countVisible(remoteSchemaFields)} types found
                  </div>
                )}
              </div>

              <Box className="space-y-6">
                {rootTypes.length > 0 && (
                  <div className="space-y-4">
                    <Text className="font-semibold text-lg">
                      Root Operations
                    </Text>
                    <div className="space-y-4 rounded border p-4">
                      {rootTypes.map((schemaType) => {
                        const actualSchemaIndex = remoteSchemaFields.findIndex(
                          (f) => f.name === schemaType.name,
                        );
                        const schemaChildren =
                          remoteSchemaFields[actualSchemaIndex]?.children;
                        return (
                          <div key={schemaType.name} className="space-y-2">
                            <Text className="font-semibold text-blue-600">
                              {schemaType.name.replace('type ', '')} Operations
                            </Text>
                            <div className="pl-4">
                              <Accordion
                                type="multiple"
                                value={openAccordionItems}
                                onValueChange={setOpenAccordionItems}
                                className="space-y-1"
                              >
                                {(schemaType.children ?? []).map((field) => {
                                  const fieldKey = `${schemaType.name}.${field.name}`;
                                  const actualFieldIndex = schemaChildren
                                    ? schemaChildren.findIndex(
                                        (f) => f.name === field.name,
                                      )
                                    : -1;

                                  if (
                                    field.args &&
                                    Object.values(field.args).length > 0
                                  ) {
                                    return (
                                      <AccordionItem
                                        key={fieldKey}
                                        value={fieldKey}
                                      >
                                        <div className="flex items-center gap-2">
                                          <Checkbox
                                            id={fieldKey}
                                            aria-label={field.name}
                                            checked={field.checked}
                                            onCheckedChange={(checked) => {
                                              const isChecked =
                                                checked as boolean;
                                              handleFieldToggle(
                                                actualSchemaIndex,
                                                actualFieldIndex,
                                                isChecked,
                                              );
                                              setOpenAccordionItems((prev) => {
                                                if (!isChecked) {
                                                  return prev.filter(
                                                    (k) => k !== fieldKey,
                                                  );
                                                }
                                                return prev.includes(fieldKey)
                                                  ? prev
                                                  : [...prev, fieldKey];
                                              });
                                            }}
                                          />
                                          <div className="flex-1">
                                            <AccordionTrigger className="justify-start py-2 text-left hover:no-underline">
                                              <div className="flex w-full items-center justify-start space-x-2 text-left">
                                                <span className="font-medium">
                                                  {field.name}
                                                </span>
                                                <span className="text-gray-500 text-sm">
                                                  : {field.return}
                                                </span>
                                                <span className="text-gray-400 text-xs">
                                                  (
                                                  {
                                                    Object.values(field.args)
                                                      .length
                                                  }{' '}
                                                  arg
                                                  {Object.values(field.args)
                                                    .length > 1
                                                    ? 's'
                                                    : ''}
                                                  )
                                                </span>
                                              </div>
                                            </AccordionTrigger>
                                          </div>
                                        </div>
                                        <AccordionContent>
                                          <div className="ml-6 space-y-2 border-gray-200 border-l-2 pl-4">
                                            <Text className="font-medium text-gray-700 text-sm">
                                              Arguments:
                                            </Text>
                                            {Object.values(field.args).map(
                                              (arg) =>
                                                renderPresetRow(
                                                  schemaType.name,
                                                  field.name,
                                                  arg,
                                                ),
                                            )}
                                          </div>
                                        </AccordionContent>
                                      </AccordionItem>
                                    );
                                  }
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
                                        <span className="ml-2 text-gray-500 text-sm">
                                          : {field.return}
                                        </span>
                                      </label>
                                    </div>
                                  );
                                })}
                              </Accordion>
                            </div>
                          </div>
                        );
                      })}

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

                {customTypes.length > 0 && (
                  <div className="space-y-4">
                    <Text className="font-semibold text-lg">Custom Types</Text>
                    <div className="space-y-4 rounded border p-4">
                      {customTypes.map((schemaType) => {
                        const actualSchemaIndex = remoteSchemaFields.findIndex(
                          (f) => f.name === schemaType.name,
                        );
                        const schemaChildren =
                          remoteSchemaFields[actualSchemaIndex]?.children;
                        return (
                          <div key={schemaType.name} className="space-y-2">
                            <Text className="font-semibold text-green-600">
                              {schemaType.name}
                            </Text>
                            <div className="space-y-1 pl-4">
                              {(schemaType.children ?? []).map((field) => {
                                const fieldKey = `${schemaType.name}.${field.name}`;
                                const actualFieldIndex = schemaChildren
                                  ? schemaChildren.findIndex(
                                      (f) => f.name === field.name,
                                    )
                                  : -1;

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
                                          <span className="ml-2 text-gray-500 text-sm">
                                            : {field.return}
                                          </span>
                                        )}
                                        {field.args &&
                                          Object.values(field.args).length >
                                            0 && (
                                            <span className="ml-2 text-gray-400 text-xs">
                                              (
                                              {Object.values(field.args).length}{' '}
                                              arg
                                              {Object.values(field.args)
                                                .length > 1
                                                ? 's'
                                                : ''}
                                              )
                                            </span>
                                          )}
                                      </label>
                                    </div>

                                    {field.expanded &&
                                      field.args &&
                                      Object.values(field.args).length > 0 && (
                                        <div className="ml-6 space-y-2 border-gray-200 border-l-2 pl-4">
                                          <Text className="font-medium text-gray-700 text-sm">
                                            Arguments:
                                          </Text>
                                          {Object.values(field.args).map(
                                            (arg) =>
                                              renderPresetRow(
                                                schemaType.name,
                                                field.name,
                                                arg,
                                              ),
                                          )}
                                        </div>
                                      )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}

                      {customTypes.length === 0 && !searchTerm && (
                        <div className="py-8 text-center text-gray-500">
                          No custom types found in schema
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {filteredFields.length === 0 && (
                  <div className="space-y-4">
                    <Text className="font-semibold text-lg">
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
            </div>
          </Box>
        </div>

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
                disabled={isRemovingPermission}
                loading={isRemovingPermission}
              >
                Delete Permissions
              </Button>
            )}

            <Button
              variant="contained"
              color="primary"
              onClick={handleSavePermission}
              disabled={
                !schemaDefinition || isAddingPermission || isUpdatingPermission
              }
              loading={isAddingPermission || isUpdatingPermission}
            >
              Save Permissions
            </Button>
          </Box>
        </Box>
      </Box>
    </Form>
  );
}
