import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useMemo } from 'react';
import { FormProvider, type Resolver, useForm } from 'react-hook-form';
import { useDialog } from '@/components/common/DialogProvider';
import { PermissionSettingsSection } from '@/components/common/PermissionSettingsSection';
import { RoleActionSwitcher } from '@/components/common/RoleActionSwitcher';
import { Form } from '@/components/form/Form';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import {
  type GroupNode,
  serializeNode,
  wrapPermissionsInAGroup,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import { useLogicalModelPermissionMutation } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelPermissionMutation';
import type { LogicalModelPermissionArgs } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelPermissionMutation/types';
import { resolveLogicalModelFieldDescriptors } from '@/features/orgs/projects/database/native-queries/utils/logicalModelPermissionFilter';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { isNotEmptyValue } from '@/lib/utils';
import type { DialogFormProps } from '@/types/common';
import type {
  LogicalModelItem,
  LogicalModelSelectPermission,
} from '@/utils/hasura-api/generated/schemas';
import FieldPermissionsSection from './sections/FieldPermissionsSection';
import RowPermissionsSection from './sections/RowPermissionsSection';
import validationSchema from './validationSchema';

export interface LogicalModelPermissionFormValues {
  rowCheckType: 'none' | 'custom';
  columns: string[];
  filter?: GroupNode;
}

interface LogicalModelPermissionFormProps extends DialogFormProps {
  source: string;
  model: LogicalModelItem;
  role: string;
  availableRoles: string[];
  onRoleChange: (role: string) => void;
  onCancel: VoidFunction;
}

function getDefaultFilter(permission?: LogicalModelSelectPermission): {
  rowCheckType: LogicalModelPermissionFormValues['rowCheckType'];
  filter: LogicalModelPermissionFormValues['filter'];
} {
  if (!permission || !isNotEmptyValue(permission.filter)) {
    return { rowCheckType: 'none', filter: wrapPermissionsInAGroup({}) };
  }

  return {
    rowCheckType: 'custom',
    filter: wrapPermissionsInAGroup(permission.filter),
  };
}

function defaultValues(
  model: LogicalModelItem,
  permission?: LogicalModelSelectPermission,
): LogicalModelPermissionFormValues {
  return {
    ...getDefaultFilter(permission),
    columns:
      permission?.columns === '*'
        ? model.fields.map(({ name }) => name)
        : (permission?.columns ?? []),
  };
}

export default function LogicalModelPermissionForm({
  source,
  model,
  role,
  availableRoles,
  onRoleChange,
  onCancel,
  location,
}: LogicalModelPermissionFormProps) {
  const existingPermission = model.select_permissions?.find(
    (item) => item.role === role,
  );
  const permission = existingPermission?.permission;
  const { data: resourceVersion } = useGetMetadataResourceVersion();
  const createMutation = useLogicalModelPermissionMutation({ type: 'add' });
  const editMutation = useLogicalModelPermissionMutation({ type: 'edit' });
  const deleteMutation = useLogicalModelPermissionMutation({ type: 'delete' });
  const isPending =
    createMutation.isPending ||
    editMutation.isPending ||
    deleteMutation.isPending;
  const fields = useMemo(
    () => resolveLogicalModelFieldDescriptors(model),
    [model],
  );
  const form = useForm<LogicalModelPermissionFormValues>({
    resolver: yupResolver(
      validationSchema,
    ) as Resolver<LogicalModelPermissionFormValues>,
    defaultValues: defaultValues(model, permission),
  });
  const { setDirtySource, openDirtyConfirmation, openAlertDialog } =
    useDialog();
  const sourceId = `logical-model-permission:${model.name}:${role}`;
  const { isDirty, isSubmitting } = form.formState;

  useEffect(() => {
    setDirtySource(sourceId, isDirty, location);
    return () => setDirtySource(sourceId, false, location);
  }, [isDirty, location, setDirtySource, sourceId]);

  function clearDirtySource() {
    setDirtySource(sourceId, false, location);
  }

  function handleCancel() {
    if (!isDirty) {
      onCancel();
      return;
    }
    openDirtyConfirmation({
      props: {
        onPrimaryAction: () => {
          clearDirtySource();
          onCancel();
        },
      },
    });
  }

  function handleRoleChange(nextRole: string) {
    clearDirtySource();
    onRoleChange(nextRole);
  }

  async function handleSubmit(values: LogicalModelPermissionFormValues) {
    const args: LogicalModelPermissionArgs = {
      name: model.name,
      role,
      permission: {
        ...(permission ?? {}),
        columns: values.columns,
        filter:
          values.rowCheckType === 'custom'
            ? serializeNode(values.filter as GroupNode)
            : {},
      },
      ...(existingPermission?.comment !== undefined
        ? { comment: existingPermission.comment }
        : {}),
    };
    const base = { source, resourceVersion: resourceVersion! };
    const save = existingPermission
      ? () =>
          editMutation.mutateAsync({
            ...base,
            args,
            original: existingPermission.permission,
          })
      : () => createMutation.mutateAsync({ ...base, args });

    await execPromiseWithErrorToast(
      async () => {
        await save();
        clearDirtySource();
        onCancel();
      },
      {
        loadingMessage: existingPermission
          ? 'Updating select permission...'
          : 'Creating select permission...',
        successMessage: existingPermission
          ? 'Select permission updated.'
          : 'Select permission created.',
        errorMessage: 'Could not save the select permission.',
      },
    );
  }

  async function handleDelete() {
    if (!existingPermission) {
      return;
    }

    await execPromiseWithErrorToast(
      async () => {
        await deleteMutation.mutateAsync({
          source,
          resourceVersion: resourceVersion!,
          name: model.name,
          role,
          original: existingPermission.permission,
          originalComment: existingPermission.comment,
        });
        clearDirtySource();
        onCancel();
      },
      {
        loadingMessage: 'Deleting select permission...',
        successMessage: 'Select permission deleted.',
        errorMessage: 'Could not delete the select permission.',
      },
    );
  }

  function handleDeleteClick() {
    openAlertDialog({
      title: 'Delete permissions',
      payload: `Are you sure you want to delete the select permissions of ${role}?`,
      props: {
        primaryButtonText: 'Delete',
        primaryButtonColor: 'error',
        onPrimaryAction: handleDelete,
      },
    });
  }

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-auto flex-col content-between overflow-hidden border-t-1 bg-background"
      >
        <div className="grid min-h-0 flex-auto grid-flow-row content-start gap-6 overflow-auto py-4">
          <PermissionSettingsSection
            title="Selected role & action"
            className="grid-flow-col justify-start gap-6"
          >
            <RoleActionSwitcher
              role={role}
              action="select"
              availableRoles={availableRoles}
              availableActions={['select']}
              actionLabels={{ select: 'Select' }}
              actionDisabled
              isDirty={isDirty}
              location={location}
              onRoleChange={handleRoleChange}
              onActionChange={() => {}}
            />
          </PermissionSettingsSection>

          <RowPermissionsSection role={role} fields={fields} />

          <FieldPermissionsSection model={model} />
        </div>

        <div className="grid flex-shrink-0 gap-2 border-t-1 p-2 sm:grid-flow-col sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            tabIndex={isDirty ? -1 : 0}
          >
            Cancel
          </Button>
          <div className="grid grid-flow-row gap-2 sm:grid-flow-col">
            {existingPermission && (
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
              loading={isSubmitting || isPending}
              disabled={!isDirty || isSubmitting || isPending}
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
