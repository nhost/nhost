import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { HighlightedText } from '@/components/presentational/HighlightedText';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { useManagePermissionMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useManagePermissionMutation';
import type {
  DatabaseAction,
  HasuraMetadataPermission,
  RuleGroup,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { convertToHasuraPermissions } from '@/features/orgs/projects/database/dataGrid/utils/convertToHasuraPermissions';
import { convertToRuleGroup } from '@/features/orgs/projects/database/dataGrid/utils/convertToRuleGroup';
import type { DialogFormProps } from '@/types/common';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import AggregationQuerySection from './sections/AggregationQuerySection';
import BackendOnlySection from './sections/BackendOnlySection';
import ColumnPermissionsSection from './sections/ColumnPermissionsSection';
import type { ColumnPreset } from './sections/ColumnPresetsSection';
import ColumnPresetsSection from './sections/ColumnPresetsSection';
import PermissionSettingsSection from './sections/PermissionSettingsSection';
import RootFieldPermissionsSection from './sections/RootFieldPermissionsSection';
import RowPermissionsSection from './sections/RowPermissionsSection';
import validationSchemas from './validationSchemas';

export interface RolePermissionEditorFormValues {
  /**
   * The permission filter to be applied for the role.
   */
  filter: Record<string, any> | {};
  /**
   * The allowed columns to CRUD for the role.
   */
  columns?: string[];
  /**
   * The number of rows to be returned for the role.
   */
  limit?: number;
  /**
   * Whether the role is allowed to perform aggregations.
   */
  allowAggregations?: boolean;
  /**
   * Whether the role is allowed to have access to special fields.
   */
  enableRootFieldCustomization?: boolean;
  /**
   * The allowed root fields in queries and mutations for the role.
   */
  queryRootFields?: string[];
  /**
   * The allowed root fields in subscriptions for the role.
   */
  subscriptionRootFields?: string[];
  /**
   * Column presets for the role.
   */
  columnPresets?: ColumnPreset[];
  /**
   * Whether the mutation should be restricted to trusted backends.
   */
  backendOnly?: boolean;
  /**
   * Computed fields to be allowed for the role.
   */
  computedFields?: string[];
}

export interface RolePermissionEditorFormProps extends DialogFormProps {
  /**
   * Determines whether or not the form is disabled.
   */
  disabled?: boolean;
  /**
   * The schema that is being edited.
   */
  schema: string;
  /**
   * The table that is being edited.
   */
  table: string;
  /**
   * The role that is being edited.
   */
  role: string;
  /**
   * The resource version of the metadata.
   */
  resourceVersion: number;
  /**
   * The action that is being edited.
   */
  action: DatabaseAction;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit: VoidFunction;
  /**
   * Function to be called when the editing is cancelled.
   */
  onCancel: VoidFunction;
  /**
   * The existing permissions for the role and action.
   */
  permission?: HasuraMetadataPermission['permission'];
}

function getDefaultRuleGroup(
  action: DatabaseAction,
  permission: HasuraMetadataPermission['permission'],
): RuleGroup | {} {
  if (!permission) {
    return null;
  }

  if (action === 'insert') {
    return convertToRuleGroup(permission.check);
  }

  return convertToRuleGroup(permission.filter);
}

function getColumnPresets(data: Record<string, any>): ColumnPreset[] {
  if (!data || Object.keys(data).length === 0) {
    return [{ column: '', value: '' }];
  }

  return Object.keys(data).map((key) => ({
    column: key,
    value: data[key],
  }));
}

function convertToColumnPresetObject(
  columnPresets: ColumnPreset[],
): Record<string, any> {
  if (columnPresets?.length === 0) {
    return null;
  }

  const returnValue = columnPresets.reduce((data, { column, value }) => {
    if (column) {
      return { ...data, [column]: value };
    }

    return data;
  }, {});

  if (Object.keys(returnValue).length === 0) {
    return null;
  }

  return returnValue;
}

export default function RolePermissionEditorForm({
  schema,
  table,
  role,
  resourceVersion,
  action,
  onSubmit,
  onCancel,
  permission,
  disabled,
  location,
}: RolePermissionEditorFormProps) {
  const queryClient = useQueryClient();
  const {
    mutateAsync: managePermission,
    error,
    reset: resetError,
    isLoading,
  } = useManagePermissionMutation({
    schema,
    table,
    mutationOptions: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['default.metadata'] });
      },
    },
  });

  const form = useForm<RolePermissionEditorFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      filter: getDefaultRuleGroup(action, permission),
      columns: permission?.columns || [],
      limit: permission?.limit || null,
      allowAggregations: permission?.allow_aggregations || false,
      enableRootFieldCustomization:
        permission?.query_root_fields?.length > 0 ||
        permission?.subscription_root_fields?.length > 0,
      queryRootFields: permission?.query_root_fields || [],
      subscriptionRootFields: permission?.subscription_root_fields || [],
      computedFields: permission?.computed_fields || [],
      columnPresets: getColumnPresets(permission?.set || {}),
      backendOnly: permission?.backend_only || false,
    },
    resolver: yupResolver(validationSchemas[action]),
  });

  const {
    formState: { dirtyFields, isSubmitting },
  } = form;

  const { onDirtyStateChange, openDirtyConfirmation, openAlertDialog } =
    useDialog();
  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  async function handleSubmit(values: RolePermissionEditorFormValues) {
    const managePermissionPromise = managePermission({
      role,
      action,
      mode: permission ? 'update' : 'insert',
      originalPermission: permission,
      resourceVersion,
      permission: {
        set: convertToColumnPresetObject(values.columnPresets),
        columns: values.columns,
        limit: values.limit,
        allow_aggregations: values.allowAggregations,
        query_root_fields:
          values.queryRootFields.length > 0 ? values.queryRootFields : null,
        subscription_root_fields:
          values.subscriptionRootFields.length > 0
            ? values.subscriptionRootFields
            : null,
        filter:
          action !== 'insert'
            ? convertToHasuraPermissions(values.filter as RuleGroup)
            : permission?.filter,
        check:
          action === 'insert'
            ? convertToHasuraPermissions(values.filter as RuleGroup)
            : permission?.check,
        backend_only: values.backendOnly,
        computed_fields:
          permission?.computed_fields?.length > 0
            ? permission?.computed_fields
            : null,
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await managePermissionPromise;
        onDirtyStateChange(false, location);
        onSubmit?.();
      },
      {
        loadingMessage: 'Saving permission...',
        successMessage: 'Permission has been saved successfully.',
        errorMessage: 'An error occurred while saving the permission.',
      },
    );
  }

  function handleCancelClick() {
    if (isDirty) {
      openDirtyConfirmation({
        props: {
          onPrimaryAction: () => {
            onDirtyStateChange(false, location);
            onCancel?.();
          },
        },
      });

      return;
    }
    onCancel?.();
  }

  async function handleDelete() {
    const deletePermissionPromise = managePermission({
      role,
      action,
      resourceVersion,
      originalPermission: permission,
      mode: 'delete',
    });

    await execPromiseWithErrorToast(
      async () => {
        await deletePermissionPromise;
        onDirtyStateChange(false, location);
        onSubmit?.();
      },
      {
        loadingMessage: 'Deleting permission...',
        successMessage: 'Permission has been deleted successfully.',
        errorMessage: 'An error occurred while deleting the permission.',
      },
    );
  }

  function handleDeleteClick() {
    openAlertDialog({
      title: 'Delete permissions',
      payload: (
        <span>
          Are you sure you want to delete the{' '}
          <HighlightedText>{action}</HighlightedText> permissions of{' '}
          <HighlightedText>{role}</HighlightedText>?
        </span>
      ),
      props: {
        primaryButtonText: 'Delete',
        primaryButtonColor: 'error',
        onPrimaryAction: handleDelete,
      },
    });
  }

  return (
    <FormProvider {...form}>
      {error && error instanceof Error && (
        <div className="-mt-3 mb-4 px-6">
          <Alert
            severity="error"
            className="grid grid-flow-col items-center justify-between px-4 py-3"
          >
            <span className="text-left">
              <strong>Error:</strong> {error.message}
            </span>

            <Button
              variant="borderless"
              color="secondary"
              className="p-1"
              onClick={resetError}
            >
              Clear
            </Button>
          </Alert>
        </div>
      )}

      <Form
        onSubmit={handleSubmit}
        className="flex flex-auto flex-col content-between overflow-hidden border-t-1"
        sx={{ backgroundColor: 'background.default' }}
      >
        <div className="grid flex-auto grid-flow-row content-start gap-6 overflow-auto py-4">
          <PermissionSettingsSection
            title="Selected role & action"
            className="grid-flow-col justify-between"
          >
            <div className="grid grid-flow-col gap-4">
              <Text>
                Role: <HighlightedText>{role}</HighlightedText>
              </Text>

              <Text>
                Action: <HighlightedText>{action}</HighlightedText>
              </Text>
            </div>

            <Button variant="borderless" onClick={handleCancelClick}>
              Change
            </Button>
          </PermissionSettingsSection>

          <RowPermissionsSection
            disabled={disabled}
            role={role}
            action={action}
            schema={schema}
            table={table}
          />

          {action !== 'delete' && (
            <ColumnPermissionsSection
              disabled={disabled}
              role={role}
              action={action}
              schema={schema}
              table={table}
            />
          )}

          {action === 'select' && (
            <>
              <AggregationQuerySection role={role} disabled={disabled} />
              <RootFieldPermissionsSection disabled={disabled} />
            </>
          )}

          {(action === 'insert' || action === 'update') && (
            <ColumnPresetsSection
              schema={schema}
              table={table}
              disabled={disabled}
            />
          )}

          {action !== 'select' && <BackendOnlySection disabled={disabled} />}
        </div>

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
                  disabled={isLoading}
                >
                  Delete Permissions
                </Button>
              )}

              <Button
                loading={isSubmitting}
                disabled={isSubmitting}
                type="submit"
                className="justify-self-end"
              >
                Save
              </Button>
            </Box>
          )}
        </Box>
      </Form>
    </FormProvider>
  );
}
