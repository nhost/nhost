import { yupResolver } from '@hookform/resolvers/yup';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useDialog } from '@/components/common/DialogProvider';
import { RoleActionSwitcher } from '@/components/common/RoleActionSwitcher';
import { Form } from '@/components/form/Form';
import { HighlightedText } from '@/components/presentational/HighlightedText';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useManagePermissionMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useManagePermissionMutation';
import type {
  DatabaseAction,
  HasuraMetadataPermission,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { GroupNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import {
  serializeNode,
  wrapPermissionsInAGroup,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import type { DialogFormProps } from '@/types/common';
import AggregationQuerySection from './sections/AggregationQuerySection';
import BackendOnlySection from './sections/BackendOnlySection';
import ColumnPermissionsSection from './sections/ColumnPermissionsSection';
import type { ColumnPreset } from './sections/ColumnPresetsSection';
import ColumnPresetsSection from './sections/ColumnPresetsSection';
import PermissionSettingsSection from './sections/PermissionSettingsSection';
import RootFieldPermissionsSection from './sections/RootFieldPermissionsSection';
import RowPermissionsSection from './sections/RowPermissionsSection';
import validationSchemas from './validationSchemas';

export type RowCheckType = 'none' | 'custom';

export interface RootFields {
  select: boolean;
  select_by_pk: boolean;
  select_aggregate: boolean;
}

const ROOT_FIELD_KEYS: readonly (keyof RootFields)[] = [
  'select',
  'select_by_pk',
  'select_aggregate',
];

export function parseRootFields(serialized?: string[] | null): RootFields {
  return {
    select: serialized?.includes('select') ?? false,
    select_by_pk: serialized?.includes('select_by_pk') ?? false,
    select_aggregate: serialized?.includes('select_aggregate') ?? false,
  };
}

export function serializeRootFields(fields?: RootFields): string[] | null {
  if (!fields) {
    return null;
  }

  const result = ROOT_FIELD_KEYS.filter((key) => fields[key]);

  return result.length > 0 ? result : null;
}

export interface RolePermissionEditorFormValues {
  /**
   * Whether custom row checks are enabled.
   */
  rowCheckType: RowCheckType;
  /**
   * The permission filter to be applied for the role.
   */
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  filter: Record<string, any> | null;
  /**
   * The allowed columns to CRUD for the role.
   */
  columns?: string[];
  /**
   * The number of rows to be returned for the role.
   */
  limit?: number | null;
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
  queryRootFields?: RootFields;
  /**
   * The allowed root fields in subscriptions for the role.
   */
  subscriptionRootFields?: RootFields;
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
   * All roles selectable in the role dropdown.
   */
  availableRoles: string[];
  /**
   * All actions selectable in the action dropdown.
   */
  allowedActions: DatabaseAction[];
  /**
   * Human-readable labels for each action.
   */
  actionLabels: Record<DatabaseAction, string>;
  /**
   * Names of computed fields configured on the table. Only relevant for the
   * `select` action; rendered as additional checkboxes alongside columns.
   */
  availableComputedFields?: string[];
  /**
   * Called when the user picks a different role from the dropdown.
   */
  onRoleChange: (role: string) => void;
  /**
   * Called when the user picks a different action from the dropdown.
   */
  onActionChange: (action: DatabaseAction) => void;
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

function getDefaultFilter(
  action: DatabaseAction,
  permission?: HasuraMetadataPermission['permission'],
): {
  rowCheckType: RowCheckType;
  filter: RolePermissionEditorFormValues['filter'];
} {
  if (!permission) {
    return { rowCheckType: 'none', filter: {} };
  }

  if (action === 'insert' && isNotEmptyValue(permission.check)) {
    return {
      rowCheckType: 'custom',
      filter: wrapPermissionsInAGroup(permission.check),
    };
  }

  if (isNotEmptyValue(permission.filter)) {
    return {
      rowCheckType: 'custom',
      filter: wrapPermissionsInAGroup(permission.filter),
    };
  }

  return { rowCheckType: 'none', filter: {} };
}

// biome-ignore lint/suspicious/noExplicitAny: TODO
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
  columnPresets?: ColumnPreset[],
  // biome-ignore lint/suspicious/noExplicitAny: TODO
): Record<string, any> | null {
  if (isEmptyValue(columnPresets)) {
    return null;
  }

  const returnValue = columnPresets!.reduce((data, { column, value }) => {
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
  availableRoles,
  allowedActions,
  actionLabels,
  availableComputedFields,
  onRoleChange,
  onActionChange,
  onSubmit,
  onCancel,
  permission,
  location,
}: RolePermissionEditorFormProps) {
  const queryClient = useQueryClient();
  const { project } = useProject();
  const {
    mutateAsync: managePermission,
    error,
    reset: resetError,
    isPending,
  } = useManagePermissionMutation({
    schema,
    table,
    mutationOptions: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
        });
      },
    },
  });

  const { rowCheckType: defaultRowCheckType, filter: defaultFilter } =
    getDefaultFilter(action, permission);

  const form = useForm<RolePermissionEditorFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      rowCheckType: defaultRowCheckType,
      filter: defaultFilter,
      columns: permission?.columns || [],
      limit: permission?.limit || null,
      allowAggregations: permission?.allow_aggregations || false,
      enableRootFieldCustomization:
        isNotEmptyValue(permission?.query_root_fields) ||
        isNotEmptyValue(permission?.subscription_root_fields),
      queryRootFields: parseRootFields(permission?.query_root_fields),
      subscriptionRootFields: parseRootFields(
        permission?.subscription_root_fields,
      ),
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
    const permissionFilter =
      values.rowCheckType === 'custom'
        ? serializeNode(values.filter as GroupNode)
        : (values.filter ?? {});

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
        query_root_fields: serializeRootFields(values.queryRootFields),
        subscription_root_fields: serializeRootFields(
          values.subscriptionRootFields,
        ),
        filter: action !== 'insert' ? permissionFilter : permission?.filter,
        check: action === 'insert' ? permissionFilter : permission?.check,
        backend_only: values.backendOnly,
        computed_fields:
          action === 'select' && isNotEmptyValue(values.computedFields)
            ? values.computedFields
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
      {error && error instanceof Error ? (
        <div className="-mt-3 mb-4 px-6">
          <Alert
            variant="destructive"
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <AlertDescription className="text-left">
              <strong>Error:</strong> {error.message}
            </AlertDescription>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetError}
            >
              Clear
            </Button>
          </Alert>
        </div>
      ) : null}

      <Form
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-auto flex-col content-between overflow-hidden border-t-1"
        sx={{ backgroundColor: 'background.default' }}
      >
        <div className="grid min-h-0 flex-auto grid-flow-row content-start gap-6 overflow-auto py-4">
          <PermissionSettingsSection
            title="Selected role & action"
            className="grid-flow-col justify-start gap-6"
          >
            <RoleActionSwitcher
              role={role}
              action={action}
              availableRoles={availableRoles}
              availableActions={allowedActions}
              actionLabels={actionLabels}
              isDirty={isDirty}
              location={location}
              onRoleChange={onRoleChange}
              onActionChange={onActionChange}
            />
          </PermissionSettingsSection>

          <RowPermissionsSection
            role={role}
            action={action}
            schema={schema}
            table={table}
          />

          {action !== 'delete' && (
            <ColumnPermissionsSection
              role={role}
              action={action}
              schema={schema}
              table={table}
              availableComputedFields={availableComputedFields}
            />
          )}

          {action === 'select' && (
            <>
              <AggregationQuerySection role={role} />
              <RootFieldPermissionsSection />
            </>
          )}

          {(action === 'insert' || action === 'update') && (
            <ColumnPresetsSection schema={schema} table={table} />
          )}

          {action !== 'select' && <BackendOnlySection />}
        </div>

        <div className="grid flex-shrink-0 gap-2 border-t-1 p-2 sm:grid-flow-col sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCancelClick}
            tabIndex={isDirty ? -1 : 0}
          >
            Cancel
          </Button>

          <div className="grid grid-flow-row gap-2 sm:grid-flow-col">
            {Boolean(permission) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleDeleteClick}
                disabled={isPending}
              >
                Delete Permissions
              </Button>
            )}

            <ButtonWithLoading
              loading={isSubmitting}
              disabled={isSubmitting}
              size="sm"
              type="submit"
              className="justify-self-end"
            >
              Save
            </ButtonWithLoading>
          </div>
        </div>
      </Form>
    </FormProvider>
  );
}
