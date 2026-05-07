import { zodResolver } from '@hookform/resolvers/zod';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import {
  buildClientSchema,
  type GraphQLArgument,
  type GraphQLSchema,
} from 'graphql';
import { Braces, Check } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { Form } from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/v3/input-group';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
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
import { createPermissionsSchema } from '@/features/orgs/projects/remote-schemas/utils/createPermissionsSchema';
import formatPresetForInput from '@/features/orgs/projects/remote-schemas/utils/formatPresetForInput';
import getArgPresetCapabilities from '@/features/orgs/projects/remote-schemas/utils/getArgPresetCapabilities';
import getBaseTypeName from '@/features/orgs/projects/remote-schemas/utils/getBaseTypeName';
import parsePresetArgTreeFromSDL from '@/features/orgs/projects/remote-schemas/utils/parsePresetArgTreeFromSDL';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { DialogFormProps } from '@/types/common';
import { useGetRolesPermissionsQuery } from '@/utils/__generated__/graphql';
import type { RemoteSchemaInfoPermissionsItem } from '@/utils/hasura-api/generated/schemas';

const rolePermissionsSchema = z.object({
  selectedFields: z.array(z.string()).optional().default([]),
  presetValues: z.any().optional().default({}),
});

type RolePermissionsFormValues = z.infer<typeof rolePermissionsSchema>;

interface PresetValueInputProps {
  arg: GraphQLArgument;
  rawValue: ArgLeafType | ArgTreeType | undefined;
  presetValue: string;
  sessionVariableOptions: string[];
  onValueChange: (value: ArgLeafType | undefined) => void;
}

function PresetValueInput({
  arg,
  rawValue,
  presetValue,
  sessionVariableOptions,
  onValueChange,
}: PresetValueInputProps) {
  const isNullPreset = rawValue === null;
  const isEmptyStringPreset = rawValue === '';
  const isPresetSet = rawValue !== undefined;

  const cap = useMemo(() => getArgPresetCapabilities(arg), [arg]);
  const enumValues = cap.isList ? null : cap.enumValues;
  const acceptsBoolean = !cap.isList && cap.isBoolean;
  const acceptsEmptyString = !cap.isList && cap.acceptsEmptyString;
  const acceptsNull = cap.isNullable;
  const allowsSessionVariables = cap.acceptsSessionVariable;

  let placeholder = 'preset value';
  if (isNullPreset) {
    placeholder = '(null literal)';
  } else if (isEmptyStringPreset) {
    placeholder = '(empty string "")';
  }

  return (
    <div className="flex flex-1 items-center space-x-2">
      <span className="min-w-0 flex-shrink-0 text-gray-600 text-sm">
        {arg.name}: {arg.type.toString()}
      </span>
      <InputGroup className="max-w-xs flex-1">
        <InputGroupInput
          placeholder={placeholder}
          value={presetValue}
          onChange={(e) =>
            onValueChange(
              e.target.value.trim() === '' ? undefined : e.target.value,
            )
          }
          className="text-xs"
          wrapperClassName="w-full"
        />
        <InputGroupAddon align="inline-end" tabIndex={-1}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <InputGroupButton
                variant="outline"
                size="icon-xs"
                aria-label="Insert preset expression"
                className="h-6 w-6 text-muted-foreground"
              >
                <Braces className="size-3.5" />
              </InputGroupButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[14rem]">
              <DropdownMenuLabel>Insert literal</DropdownMenuLabel>
              {acceptsNull && (
                <DropdownMenuItem onSelect={() => onValueChange(null)}>
                  <span className="font-mono">null</span>
                </DropdownMenuItem>
              )}
              {acceptsEmptyString && (
                <DropdownMenuItem onSelect={() => onValueChange('')}>
                  <span className="font-mono">&quot;&quot;</span>
                  <span className="ml-2 text-muted-foreground text-xs">
                    empty string
                  </span>
                </DropdownMenuItem>
              )}
              {acceptsBoolean && (
                <>
                  <DropdownMenuItem onSelect={() => onValueChange(true)}>
                    <span className="font-mono">true</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onValueChange(false)}>
                    <span className="font-mono">false</span>
                  </DropdownMenuItem>
                </>
              )}
              {enumValues && enumValues.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Enum values</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                      {enumValues.map((v) => (
                        <DropdownMenuItem
                          key={v.name}
                          onSelect={() => onValueChange(v.name)}
                        >
                          <span className="font-mono">{v.name}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              )}
              {allowsSessionVariables && sessionVariableOptions.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      Session variables
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                      {sessionVariableOptions.map((v) => (
                        <DropdownMenuItem
                          key={v}
                          onSelect={() => onValueChange(v)}
                        >
                          <span className="font-mono">{v}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              )}
              {isPresetSet && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => onValueChange(undefined)}
                    className="text-destructive focus:text-destructive"
                  >
                    Clear preset
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
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

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const { project } = useProject();
  const { data: permissionVariablesData } = useGetRolesPermissionsQuery({
    variables: { appId: project?.id },
    skip: !project?.id,
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
        if (!schemaType || !schemaType.children) {
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
          if (
            !['String', 'Int', 'Float', 'Boolean', 'ID'].includes(
              returnBaseType,
            )
          ) {
            typesToCheck.add(returnBaseType);
          }

          if (currentField.args) {
            Object.values(currentField.args).forEach((arg) => {
              let argTypeString = '';
              if (typeof arg === 'object' && arg.type) {
                if (typeof arg.type === 'string') {
                  argTypeString = arg.type;
                } else if (arg.type.toString) {
                  argTypeString = arg.type.toString();
                }
              }

              const argBaseType = getBaseTypeName(argTypeString);

              if (
                argBaseType &&
                !['String', 'Int', 'Float', 'Boolean', 'ID'].includes(
                  argBaseType,
                )
              ) {
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

            const typeNames = [
              `type ${baseType}`,
              `input ${baseType}`,
              `enum ${baseType}`,
              `scalar ${baseType}`,
              `union ${baseType}`,
              `interface ${baseType}`,
            ];

            const depTypeIndex = newFields.findIndex((type) =>
              typeNames.includes(type.name),
            );

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
                    if (
                      !['String', 'Int', 'Float', 'Boolean', 'ID'].includes(
                        childBaseType,
                      )
                    ) {
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
        const newArgTree = { ...prev };
        const typeBucket = (newArgTree[schemaTypeName] ?? {}) as ArgTreeType;
        const fieldBucket = (typeBucket[fieldName] ?? {}) as ArgTreeType;

        if (value === undefined) {
          delete fieldBucket[argName];
          if (Object.keys(fieldBucket).length === 0) {
            delete typeBucket[fieldName];
          } else {
            typeBucket[fieldName] = fieldBucket;
          }
          if (Object.keys(typeBucket).length === 0) {
            delete newArgTree[schemaTypeName];
          } else {
            newArgTree[schemaTypeName] = typeBucket;
          }
          return newArgTree;
        }

        fieldBucket[argName] = value;
        typeBucket[fieldName] = fieldBucket;
        newArgTree[schemaTypeName] = typeBucket;
        return newArgTree;
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
          presetValue={formatPresetForInput(rawValue)}
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
                      {rootTypes.map((schemaType) => (
                        <div key={schemaType.name} className="space-y-2">
                          <Text className="font-semibold text-blue-600">
                            {schemaType.name.replace('type ', '')} Operations
                          </Text>
                          <div className="pl-4">
                            <Accordion type="multiple" className="space-y-1">
                              {(schemaType.children ?? []).map((field) => {
                                const fieldKey = `${schemaType.name}.${field.name}`;
                                const actualSchemaIndex =
                                  remoteSchemaFields.findIndex(
                                    (f) => f.name === schemaType.name,
                                  );
                                const actualFieldIndex = remoteSchemaFields[
                                  actualSchemaIndex
                                ]?.children
                                  ? remoteSchemaFields[
                                      actualSchemaIndex
                                    ].children!.findIndex(
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
                                      <AccordionTrigger className="justify-start py-2 text-left hover:no-underline">
                                        <div className="flex w-full items-center justify-start space-x-2 text-left">
                                          <CheckboxPrimitive.Root
                                            asChild
                                            id={fieldKey}
                                            checked={field.checked}
                                            onCheckedChange={(checked) =>
                                              handleFieldToggle(
                                                actualSchemaIndex,
                                                actualFieldIndex,
                                                checked as boolean,
                                              )
                                            }
                                            className="peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                                          >
                                            <span className="peer h-4 w-4 shrink-0 rounded-sm border border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground">
                                              <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
                                                <Check className="h-4 w-4" />
                                              </CheckboxPrimitive.Indicator>
                                            </span>
                                          </CheckboxPrimitive.Root>
                                          <span className="font-medium">
                                            {field.name}
                                          </span>
                                          <span className="text-gray-500 text-sm">
                                            : {field.return}
                                          </span>
                                          <span className="text-gray-400 text-xs">
                                            ({Object.values(field.args).length}{' '}
                                            arg
                                            {Object.values(field.args).length >
                                            1
                                              ? 's'
                                              : ''}
                                            )
                                          </span>
                                        </div>
                                      </AccordionTrigger>
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

                {customTypes.length > 0 && (
                  <div className="space-y-4">
                    <Text className="font-semibold text-lg">Custom Types</Text>
                    <div className="space-y-4 rounded border p-4">
                      {customTypes.map((schemaType) => (
                        <div key={schemaType.name} className="space-y-2">
                          <Text className="font-semibold text-green-600">
                            {schemaType.name}
                          </Text>
                          <div className="space-y-1 pl-4">
                            {(schemaType.children ?? []).map((field) => {
                              const fieldKey = `${schemaType.name}.${field.name}`;
                              const actualSchemaIndex =
                                remoteSchemaFields.findIndex(
                                  (f) => f.name === schemaType.name,
                                );
                              const actualFieldIndex = remoteSchemaFields[
                                actualSchemaIndex
                              ]?.children
                                ? remoteSchemaFields[
                                    actualSchemaIndex
                                  ].children!.findIndex(
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
                                            ({Object.values(field.args).length}{' '}
                                            arg
                                            {Object.values(field.args).length >
                                            1
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
                                        {Object.values(field.args).map((arg) =>
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
                      ))}

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
