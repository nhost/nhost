import { yupResolver } from '@hookform/resolvers/yup';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import { useManagePermissionMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useManagePermissionMutation';
import type { HasuraMetadataPermission } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { GroupNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import {
  unWrapRuleNodes,
  wrapPermissionsInAGroup,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { isNotEmptyValue } from '@/lib/utils';
import type { RowCheckType } from './types';
import type { DialogFormProps } from '@/types/common';

import StorageRowPermissionsSection from './StorageRowPermissionsSection';
import StorageUploadPresetSection from './StorageUploadPresetSection';
import {
  STORAGE_ACTION_LABELS,
  STORAGE_ACTION_TO_DB_ACTION,
  STORAGE_COLUMNS_BY_ACTION,
  STORAGE_SCHEMA,
  STORAGE_TABLE,
  type StorageAction,
  type StoragePermissionEditorFormValues,
} from './types';
import storageValidationSchemas from './validationSchemas';

export interface StorageRolePermissionEditorFormProps extends DialogFormProps {
  disabled?: boolean;
  role: string;
  resourceVersion: number;
  storageAction: StorageAction;
  onSubmit: VoidFunction;
  onCancel: VoidFunction;
  permission?: HasuraMetadataPermission['permission'];
}

function getDefaultFilter(
  storageAction: StorageAction,
  permission?: HasuraMetadataPermission['permission'],
): { rowCheckType: RowCheckType; filter: StoragePermissionEditorFormValues['filter'] } {
  if (!permission) {
    return { rowCheckType: 'none', filter: {} };
  }

  const dbAction = STORAGE_ACTION_TO_DB_ACTION[storageAction];

  if (dbAction === 'insert' && isNotEmptyValue(permission.check)) {
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

export default function StorageRolePermissionEditorForm({
  role,
  resourceVersion,
  storageAction,
  onSubmit,
  onCancel,
  permission,
  disabled,
  location,
}: StorageRolePermissionEditorFormProps) {
  const queryClient = useQueryClient();
  const dbAction = STORAGE_ACTION_TO_DB_ACTION[storageAction];
  const actionLabel = STORAGE_ACTION_LABELS[storageAction];

  const {
    mutateAsync: managePermission,
    error,
    reset: resetError,
    isPending,
  } = useManagePermissionMutation({
    dataSource: 'default',
    schema: STORAGE_SCHEMA,
    table: STORAGE_TABLE,
  });

  const { rowCheckType: defaultRowCheckType, filter: defaultFilter } =
    getDefaultFilter(storageAction, permission);

  const form = useForm<StoragePermissionEditorFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      rowCheckType: defaultRowCheckType,
      filter: defaultFilter,
      prefillUploadedByUserId: Boolean(permission?.set?.uploaded_by_user_id),
    },
    resolver: yupResolver(storageValidationSchemas[storageAction]),
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

  async function handleSubmit(values: StoragePermissionEditorFormValues) {
    const permissionFilter =
      values.rowCheckType === 'custom'
        ? unWrapRuleNodes(values.filter as GroupNode)
        : values.filter ?? {};

    const managePermissionPromise = managePermission({
      role,
      action: dbAction,
      mode: permission ? 'update' : 'insert',
      originalPermission: permission,
      resourceVersion,
      permission: {
        columns: STORAGE_COLUMNS_BY_ACTION[storageAction],
        set: values.prefillUploadedByUserId
          ? { uploaded_by_user_id: 'X-Hasura-User-Id' }
          : null,
        filter: dbAction !== 'insert' ? permissionFilter : permission?.filter,
        check: dbAction === 'insert' ? permissionFilter : permission?.check,
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await managePermissionPromise;
        await queryClient.invalidateQueries({
          queryKey: ['default.metadata'],
        });
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
      action: dbAction,
      resourceVersion,
      originalPermission: permission,
      mode: 'delete',
    });

    await execPromiseWithErrorToast(
      async () => {
        await deletePermissionPromise;
        await queryClient.invalidateQueries({
          queryKey: ['default.metadata'],
        });
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
          Are you sure you want to delete the <strong>{actionLabel}</strong>{' '}
          permissions of <strong>{role}</strong>?
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
          <div className="flex items-center justify-between rounded-md border border-destructive bg-destructive/10 px-4 py-3">
            <span className="text-left text-sm">
              <strong>Error:</strong> {error.message}
            </span>

            <Button variant="ghost" size="sm" onClick={resetError}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      <Form
        onSubmit={handleSubmit}
        className="flex flex-auto flex-col content-between overflow-hidden border-t-1 bg-[#fafafa] dark:bg-[#151a22]"
      >
        <div className="grid flex-auto grid-flow-row content-start gap-6 overflow-auto py-4">
          <div className="flex items-center justify-between border-y-1 px-6 py-3">
            <div className="flex gap-4 text-sm">
              <span>
                Role: <strong>{role}</strong>
              </span>
              <span>
                Action: <strong>{actionLabel}</strong>
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={handleCancelClick}
            >
              Change
            </Button>
          </div>

          <StorageRowPermissionsSection
            disabled={disabled}
            role={role}
            storageAction={storageAction}
          />

          {(storageAction === 'upload' || storageAction === 'replace') && (
            <StorageUploadPresetSection disabled={disabled} />
          )}
        </div>

        <div className="grid flex-shrink-0 gap-2 border-t-1 p-2 sm:grid-flow-col sm:justify-between">
          <Button
            variant="ghost"
            type="button"
            onClick={handleCancelClick}
            tabIndex={isDirty ? -1 : 0}
          >
            Cancel
          </Button>

          {!disabled && (
            <div className="grid grid-flow-row gap-2 sm:grid-flow-col">
              {Boolean(permission) && (
                <Button
                  variant="outline"
                  type="button"
                  className="text-destructive hover:text-destructive"
                  onClick={handleDeleteClick}
                  disabled={isPending}
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
