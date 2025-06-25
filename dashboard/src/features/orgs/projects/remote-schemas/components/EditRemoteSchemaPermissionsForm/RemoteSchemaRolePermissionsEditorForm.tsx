import { yupResolver } from '@hookform/resolvers/yup';
import { useTheme } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { buildClientSchema, type GraphQLSchema } from 'graphql';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ControlledTreeEnvironment, Tree } from 'react-complex-tree';
import 'react-complex-tree/lib/style-modern.css';
import { FormProvider, useForm } from 'react-hook-form';
import * as yup from 'yup';

import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { HighlightedText } from '@/components/presentational/HighlightedText';
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
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { DialogFormProps } from '@/types/common';
import type { RemoteSchemaInfoPermissionsItem } from '@/utils/hasura-api/generated/schemas';

interface ComplexTreeData {
  [key: string]: {
    index: string;
    canMove: boolean;
    isFolder: boolean;
    children?: string[];
    data: string | React.ReactNode;
    title?: string;
    canRename: boolean;
    checkable?: boolean;
    checked?: boolean;
  };
}

interface RemoteSchemaPermissionFormValues {
  selectedFields?: string[];
  schemaDefinition?: string;
}

interface RemoteSchemaRolePermissionsEditorFormProps extends DialogFormProps {
  disabled?: boolean;
  remoteSchemaName: string;
  role: string;
  onSubmit: () => void;
  onCancel: () => void;
  permission?: RemoteSchemaInfoPermissionsItem;
}

const validationSchema = yup.object({
  selectedFields: yup
    .array()
    .of(yup.string())
    .default([])
    .required('At least one field must be selected'),
  schemaDefinition: yup.string().required('Schema definition is required'),
});

// Helper functions adapted from Hasura console
const buildTreeDataFromSchema = (schema: GraphQLSchema): ComplexTreeData => {
  const treeData: ComplexTreeData = {};

  // Add root item
  treeData.root = {
    index: 'root',
    canMove: false,
    isFolder: true,
    children: [],
    data: 'Schema',
    title: 'Schema',
    canRename: false,
  };

  // Add query root
  const queryType = schema.getQueryType();
  if (queryType) {
    const queryKey = '__query_root';
    treeData[queryKey] = {
      index: queryKey,
      canMove: false,
      isFolder: true,
      children: [],
      data: (
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            className="form-checkbox h-4 w-4 text-blue-600"
            data-field-key={queryKey}
          />
          <span className="font-medium text-blue-600">Query</span>
        </div>
      ),
      canRename: false,
      checkable: true,
    };
    treeData.root.children!.push(queryKey);

    // Add query fields
    const queryFields = queryType.getFields();
    Object.keys(queryFields).forEach((fieldName) => {
      const field = queryFields[fieldName];
      const fieldKey = `${queryKey}.field.${fieldName}`;

      treeData[fieldKey] = {
        index: fieldKey,
        canMove: false,
        isFolder: field.args.length > 0,
        children: field.args.length > 0 ? [] : undefined,
        data: (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              className="form-checkbox h-4 w-4 text-blue-600"
              data-field-key={fieldKey}
            />
            <span>{fieldName}</span>
            <span className="text-sm text-gray-500">
              : {field.type.toString()}
            </span>
          </div>
        ),
        canRename: false,
        checkable: true,
      };
      treeData[queryKey].children!.push(fieldKey);

      // Add arguments if present
      field.args.forEach((arg) => {
        const argKey = `${fieldKey}.arg.${arg.name}`;
        treeData[argKey] = {
          index: argKey,
          canMove: false,
          isFolder: false,
          data: (
            <div className="flex items-center space-x-2 pl-4">
              <input
                type="checkbox"
                className="form-checkbox h-4 w-4 text-green-600"
                data-field-key={argKey}
              />
              <span className="text-green-600">{arg.name}</span>
              <span className="text-sm text-gray-500">
                : {arg.type.toString()}
              </span>
            </div>
          ),
          canRename: false,
          checkable: true,
        };
        treeData[fieldKey].children!.push(argKey);
      });
    });
  }

  // Add mutation root
  const mutationType = schema.getMutationType();
  if (mutationType) {
    const mutationKey = '__mutation_root';
    treeData[mutationKey] = {
      index: mutationKey,
      canMove: false,
      isFolder: true,
      children: [],
      data: (
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            className="form-checkbox h-4 w-4 text-purple-600"
            data-field-key={mutationKey}
          />
          <span className="font-medium text-purple-600">Mutation</span>
        </div>
      ),
      canRename: false,
      checkable: true,
    };
    treeData.root.children!.push(mutationKey);

    // Add mutation fields (similar to query fields)
    const mutationFields = mutationType.getFields();
    Object.keys(mutationFields).forEach((fieldName) => {
      const field = mutationFields[fieldName];
      const fieldKey = `${mutationKey}.field.${fieldName}`;

      treeData[fieldKey] = {
        index: fieldKey,
        canMove: false,
        isFolder: field.args.length > 0,
        children: field.args.length > 0 ? [] : undefined,
        data: (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              className="form-checkbox h-4 w-4 text-purple-600"
              data-field-key={fieldKey}
            />
            <span>{fieldName}</span>
            <span className="text-sm text-gray-500">
              : {field.type.toString()}
            </span>
          </div>
        ),
        canRename: false,
        checkable: true,
      };
      treeData[mutationKey].children!.push(fieldKey);

      // Add arguments
      field.args.forEach((arg) => {
        const argKey = `${fieldKey}.arg.${arg.name}`;
        treeData[argKey] = {
          index: argKey,
          canMove: false,
          isFolder: false,
          data: (
            <div className="flex items-center space-x-2 pl-4">
              <input
                type="checkbox"
                className="form-checkbox h-4 w-4 text-green-600"
                data-field-key={argKey}
              />
              <span className="text-green-600">{arg.name}</span>
              <span className="text-sm text-gray-500">
                : {arg.type.toString()}
              </span>
            </div>
          ),
          canRename: false,
          checkable: true,
        };
        treeData[fieldKey].children!.push(argKey);
      });
    });
  }

  // Add subscription root
  const subscriptionType = schema.getSubscriptionType();
  if (subscriptionType) {
    const subscriptionKey = '__subscription_root';
    treeData[subscriptionKey] = {
      index: subscriptionKey,
      canMove: false,
      isFolder: true,
      children: [],
      data: (
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            className="form-checkbox h-4 w-4 text-orange-600"
            data-field-key={subscriptionKey}
          />
          <span className="font-medium text-orange-600">Subscription</span>
        </div>
      ),
      canRename: false,
      checkable: true,
    };
    treeData.root.children!.push(subscriptionKey);

    // Add subscription fields (similar to query fields)
    const subscriptionFields = subscriptionType.getFields();
    Object.keys(subscriptionFields).forEach((fieldName) => {
      const field = subscriptionFields[fieldName];
      const fieldKey = `${subscriptionKey}.field.${fieldName}`;

      treeData[fieldKey] = {
        index: fieldKey,
        canMove: false,
        isFolder: field.args.length > 0,
        children: field.args.length > 0 ? [] : undefined,
        data: (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              className="form-checkbox h-4 w-4 text-orange-600"
              data-field-key={fieldKey}
            />
            <span>{fieldName}</span>
            <span className="text-sm text-gray-500">
              : {field.type.toString()}
            </span>
          </div>
        ),
        canRename: false,
        checkable: true,
      };
      treeData[subscriptionKey].children!.push(fieldKey);

      // Add arguments
      field.args.forEach((arg) => {
        const argKey = `${fieldKey}.arg.${arg.name}`;
        treeData[argKey] = {
          index: argKey,
          canMove: false,
          isFolder: false,
          data: (
            <div className="flex items-center space-x-2 pl-4">
              <input
                type="checkbox"
                className="form-checkbox h-4 w-4 text-green-600"
                data-field-key={argKey}
              />
              <span className="text-green-600">{arg.name}</span>
              <span className="text-sm text-gray-500">
                : {arg.type.toString()}
              </span>
            </div>
          ),
          canRename: false,
          checkable: true,
        };
        treeData[fieldKey].children!.push(argKey);
      });
    });
  }

  return treeData;
};

const generateSchemaDefinition = (selectedFields: string[]): string => {
  // This is a simplified version. In production, you'd want to implement
  // the full SDL generation logic from the Hasura console
  const lines: string[] = [];

  selectedFields.forEach((fieldKey) => {
    if (fieldKey.includes('__query_root')) {
      lines.push('type Query {');
      // Add selected query fields
      lines.push('}');
    } else if (fieldKey.includes('__mutation_root')) {
      lines.push('type Mutation {');
      // Add selected mutation fields
      lines.push('}');
    } else if (fieldKey.includes('__subscription_root')) {
      lines.push('type Subscription {');
      // Add selected subscription fields
      lines.push('}');
    }
  });

  return lines.join('\n');
};

export default function RemoteSchemaRolePermissionsEditorForm({
  remoteSchemaName,
  role,
  onSubmit,
  onCancel,
  permission,
  disabled,
  location,
}: RemoteSchemaRolePermissionsEditorFormProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const treeRef = useRef<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [expandedItems, setExpandedItems] = useState<string[]>(['root']);
  const [treeData, setTreeData] = useState<ComplexTreeData>({});

  // Fetch remote schema introspection
  const {
    data: introspectionData,
    isLoading: isLoadingSchema,
    error: schemaError,
  } = useIntrospectRemoteSchemaQuery(remoteSchemaName);

  // Mutations for managing permissions
  const addPermissionMutation = useAddRemoteSchemaPermissionsMutation();
  const updatePermissionMutation = useUpdateRemoteSchemaPermissionsMutation();
  const removePermissionMutation = useRemoveRemoteSchemaPermissionsMutation();

  const form = useForm<RemoteSchemaPermissionFormValues>({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      selectedFields: [],
      schemaDefinition: permission?.definition?.schema || '',
    },
  });

  const { onDirtyStateChange, openDirtyConfirmation, openAlertDialog } =
    useDialog();
  const {
    formState: { isDirty, isSubmitting },
  } = form;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  // Build tree data when schema is loaded
  useEffect(() => {
    if (introspectionData?.data) {
      try {
        const schema = buildClientSchema(introspectionData.data as any);
        const newTreeData = buildTreeDataFromSchema(schema);
        setTreeData(newTreeData);
      } catch (error) {
        console.error('Error building schema:', error);
      }
    }
  }, [introspectionData]);

  // Handle field selection
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

  // Handle tree interaction
  const handleTreeClick = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      const checkbox = target.closest(
        'input[type="checkbox"]',
      ) as HTMLInputElement;

      if (checkbox) {
        const { fieldKey } = checkbox.dataset;
        if (fieldKey) {
          const { checked } = checkbox;
          handleFieldToggle(fieldKey, checked);

          // Update form values
          form.setValue(
            'selectedFields',
            checked
              ? [...selectedFields, fieldKey]
              : selectedFields.filter((key) => key !== fieldKey),
          );
        }
      }
    },
    [selectedFields, handleFieldToggle, form],
  );

  // Generate schema definition when fields change
  useEffect(() => {
    if (selectedFields.length > 0) {
      try {
        const schemaDefinition = generateSchemaDefinition(selectedFields);
        form.setValue('schemaDefinition', schemaDefinition);
      } catch (error) {
        console.error('Error generating schema definition:', error);
      }
    }
  }, [selectedFields, form]);

  const handleSubmit = async (values: RemoteSchemaPermissionFormValues) => {
    try {
      if (permission) {
        // Update existing permission
        await updatePermissionMutation.mutateAsync({
          role,
          remoteSchema: remoteSchemaName,
          originalPermissionSchema: permission.definition.schema,
          newPermissionSchema: values.schemaDefinition || '',
        });
      } else {
        // Add new permission
        await addPermissionMutation.mutateAsync({
          args: {
            remote_schema: remoteSchemaName,
            role,
            definition: {
              schema: values.schemaDefinition || '',
            },
          },
        });
      }

      await execPromiseWithErrorToast(
        async () => {
          queryClient.invalidateQueries({ queryKey: ['default.metadata'] });
          onDirtyStateChange(false, location);
          onSubmit();
        },
        {
          loadingMessage: 'Saving permission...',
          successMessage: 'Permission has been saved successfully.',
          errorMessage: 'An error occurred while saving the permission.',
        },
      );
    } catch (error) {
      console.error('Error saving permission:', error);
    }
  };

  const handleDelete = async () => {
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

      await execPromiseWithErrorToast(
        async () => {
          queryClient.invalidateQueries({ queryKey: ['default.metadata'] });
          onDirtyStateChange(false, location);
          onSubmit();
        },
        {
          loadingMessage: 'Deleting permission...',
          successMessage: 'Permission has been deleted successfully.',
          errorMessage: 'An error occurred while deleting the permission.',
        },
      );
    } catch (error) {
      console.error('Error deleting permission:', error);
    }
  };

  const handleDeleteClick = () => {
    openAlertDialog({
      title: 'Delete permissions',
      payload: (
        <span>
          Are you sure you want to delete the permissions for{' '}
          <HighlightedText>{role}</HighlightedText> on{' '}
          <HighlightedText>{remoteSchemaName}</HighlightedText>?
        </span>
      ),
      props: {
        primaryButtonText: 'Delete',
        primaryButtonColor: 'error',
        onPrimaryAction: handleDelete,
      },
    });
  };

  const handleCancelClick = () => {
    if (isDirty) {
      openDirtyConfirmation({
        props: {
          onPrimaryAction: () => {
            onDirtyStateChange(false, location);
            onCancel();
          },
        },
      });
      return;
    }
    onCancel();
  };

  if (isLoadingSchema) {
    return (
      <div className="p-6">
        <ActivityIndicator label="Loading remote schema..." />
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
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="flex flex-auto flex-col content-between overflow-hidden border-t-1"
        sx={{ backgroundColor: 'background.default' }}
      >
        <div className="grid flex-auto grid-flow-row content-start gap-6 overflow-hidden p-4">
          {/* Header */}
          <Box className="space-y-4 rounded border-1 p-4">
            <div className="flex items-center justify-between">
              <div className="grid grid-flow-col gap-4">
                <Text>
                  Remote Schema:{' '}
                  <HighlightedText>{remoteSchemaName}</HighlightedText>
                </Text>
                <Text>
                  Role: <HighlightedText>{role}</HighlightedText>
                </Text>
              </div>
              <Button variant="borderless" onClick={handleCancelClick}>
                Change
              </Button>
            </div>
          </Box>

          {/* Search */}
          <Box className="space-y-4 rounded border-1 p-4">
            <Text className="text-lg font-semibold">Search Fields</Text>
            <Input
              placeholder="Search schema fields..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </Box>

          {/* Schema Tree */}
          <Box className="flex-1 space-y-4 overflow-hidden rounded border-1 p-4">
            <Text className="text-lg font-semibold">
              Select Fields for {role}
            </Text>
            <div
              className={`flex-1 overflow-auto ${theme.palette.mode === 'dark' ? 'rct-dark' : ''}`}
              style={
                theme.palette.mode === 'dark'
                  ? {
                      backgroundColor: '#171d26',
                      color: '#e3e3e3',
                    }
                  : undefined
              }
              onClick={handleTreeClick}
              onKeyDown={handleTreeClick as any}
              role="tree"
              tabIndex={0}
            >
              <ControlledTreeEnvironment
                items={treeData}
                getItemTitle={(item) => {
                  if (typeof item.data === 'string') return item.data;
                  // Extract text content from React nodes
                  if (item.index === 'root') return 'Schema';
                  if (item.index.includes('__query_root')) return 'Query';
                  if (item.index.includes('__mutation_root')) return 'Mutation';
                  if (item.index.includes('__subscription_root'))
                    return 'Subscription';
                  // For field nodes, extract field name from index
                  const parts = String(item.index).split('.');
                  return parts[parts.length - 1] || String(item.index);
                }}
                viewState={{
                  'schema-tree': {
                    expandedItems,
                    selectedItems: [],
                    focusedItem: undefined,
                  },
                }}
                onExpandItem={(item) =>
                  setExpandedItems((prev) => [...prev, String(item.index)])
                }
                onCollapseItem={(item) =>
                  setExpandedItems((prev) =>
                    prev.filter((id) => id !== String(item.index)),
                  )
                }
                onSelectItems={() => {}}
              >
                <Tree
                  ref={treeRef}
                  treeId="schema-tree"
                  rootItem="root"
                  treeLabel="Remote Schema Permission Tree"
                />
              </ControlledTreeEnvironment>
            </div>
          </Box>

          {/* Schema Definition Preview */}
          <Box className="space-y-4 rounded border-1 p-4">
            <Text className="text-lg font-semibold">
              Generated Schema Definition
            </Text>
            <pre className="max-h-40 overflow-auto rounded bg-gray-100 p-4 text-sm">
              {form.watch('schemaDefinition') || 'No fields selected'}
            </pre>
          </Box>
        </div>

        {/* Actions */}
        <Box className="grid flex-shrink-0 gap-2 border-t-1 p-2 sm:grid-flow-col sm:justify-between">
          <Button
            variant="borderless"
            color="secondary"
            onClick={handleCancelClick}
            tabIndex={isDirty ? -1 : 0}
          >
            Cancel
          </Button>

          {!disabled && (
            <Box className="grid grid-flow-row gap-2 sm:grid-flow-col">
              {Boolean(permission) && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleDeleteClick}
                  disabled={isSubmitting}
                >
                  Delete Permissions
                </Button>
              )}

              <Button
                loading={isSubmitting}
                disabled={isSubmitting || selectedFields.length === 0}
                type="submit"
                className="justify-self-end"
              >
                Save Permissions
              </Button>
            </Box>
          )}
        </Box>
      </Form>
    </FormProvider>
  );
}
