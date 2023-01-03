import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import HighlightedText from '@/components/common/HighlightedText';
import useManagePermissionMutation from '@/hooks/dataBrowser/useManagePermissionMutation';
import type {
  DatabaseAction,
  HasuraMetadataPermission,
  RuleGroup,
} from '@/types/dataBrowser';
import { Alert } from '@/ui/Alert';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import convertToHasuraPermissions from '@/utils/dataBrowser/convertToHasuraPermissions';
import convertToRuleGroup from '@/utils/dataBrowser/convertToRuleGroup';
import { toastStyleProps } from '@/utils/settings/settingsConstants';
import { yupResolver } from '@hookform/resolvers/yup';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
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
}

export interface RolePermissionEditorFormProps {
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
  action,
  onSubmit,
  onCancel,
  permission,
  disabled,
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
    onDirtyStateChange(isDirty, 'drawer');
  }, [isDirty, onDirtyStateChange]);

  async function handleSubmit(values: RolePermissionEditorFormValues) {
    const managePermissionPromise = managePermission({
      role,
      action,
      mode: permission ? 'update' : 'insert',
      originalPermission: permission,
      permission: {
        set: convertToColumnPresetObject(values.columnPresets),
        columns: values.columns,
        limit: values.limit,
        allow_aggregations: values.allowAggregations,
        query_root_fields: values.queryRootFields,
        subscription_root_fields: values.subscriptionRootFields,
        filter:
          action !== 'insert'
            ? convertToHasuraPermissions(values.filter as RuleGroup)
            : permission?.filter,
        check:
          action === 'insert'
            ? convertToHasuraPermissions(values.filter as RuleGroup)
            : permission?.check,
        backend_only: values.backendOnly,
      },
    });

    await toast.promise(
      managePermissionPromise,
      {
        loading: 'Saving permission...',
        success: 'Permission has been saved successfully.',
        error: 'An error occurred while saving the permission.',
      },
      toastStyleProps,
    );

    onDirtyStateChange(false, 'drawer');
    onSubmit?.();
  }

  function handleCancelClick() {
    if (isDirty) {
      openDirtyConfirmation({
        props: {
          onPrimaryAction: () => {
            onDirtyStateChange(false, 'drawer');
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
      originalPermission: permission,
      mode: 'delete',
    });

    await toast.promise(
      deletePermissionPromise,
      {
        loading: 'Deleting permission...',
        success: 'Permission has been deleted successfully.',
        error: 'An error occurred while deleting the permission.',
      },
      toastStyleProps,
    );

    onDirtyStateChange(false, 'drawer');
    onSubmit?.();
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
        className="flex flex-auto flex-col content-between overflow-hidden border-t-1 border-gray-200 bg-[#fafafa]"
      >
        <div className="grid grid-flow-row gap-6 content-start flex-auto py-4 overflow-auto">
          <PermissionSettingsSection
            title="Selected role & action"
            className="justify-between grid-flow-col"
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

        <div className="grid flex-shrink-0 sm:grid-flow-col sm:justify-between gap-2 border-t-1 border-gray-200 p-2 bg-white">
          <Button
            variant="borderless"
            color="secondary"
            onClick={handleCancelClick}
            tabIndex={isDirty ? -1 : 0}
          >
            Cancel
          </Button>

          {!disabled && (
            <div className="grid grid-flow-row sm:grid-flow-col gap-2">
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
            </div>
          )}
        </div>
      </Form>
    </FormProvider>
  );
}
