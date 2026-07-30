import { useState } from 'react';
import {
  type AccessLevel,
  PermissionsGrid,
} from '@/components/common/PermissionsGrid';
import { PermissionsGridLayout } from '@/components/common/PermissionsGridLayout';
import { Spinner } from '@/components/ui/v3/spinner';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import LogicalModelPermissionForm from '@/features/orgs/projects/database/native-queries/components/LogicalModelPermissionForm';
import useGetLogicalModels from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import useLogicalModelPermissionMutation from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelPermissionMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useGetRemoteAppRolesQuery } from '@/generated/graphql';
import type { DialogFormProps } from '@/types/common';
import type {
  LogicalModelItem,
  LogicalModelSelectPermission,
  LogicalModelSelectPermissionItem,
} from '@/utils/hasura-api/generated/schemas';

export interface EditLogicalModelPermissionsFormProps extends DialogFormProps {
  logicalModelName: string;
  onCancel?: VoidFunction;
}

function hasFullAccess(permission: LogicalModelSelectPermission): boolean {
  return (
    permission.columns === '*' &&
    Object.keys(permission.filter ?? {}).length === 0
  );
}

function getPermissionAccess(
  permission?: LogicalModelSelectPermission,
): AccessLevel {
  if (permission && hasFullAccess(permission)) {
    return 'full';
  }

  return permission ? 'partial' : 'none';
}

function LogicalModelPermissionEditor({
  model,
  models,
  role,
  availableRoles,
  location,
  onRoleChange,
  onBack,
}: {
  model: LogicalModelItem;
  models: LogicalModelItem[];
  role: string;
  availableRoles: string[];
  location?: DialogFormProps['location'];
  onRoleChange: (role: string) => void;
  onBack: VoidFunction;
}) {
  const existing = model.select_permissions?.find(
    (permission) => permission.role === role,
  );
  const createMutation = useLogicalModelPermissionMutation({ type: 'add' });
  const editMutation = useLogicalModelPermissionMutation({ type: 'edit' });
  const deleteMutation = useLogicalModelPermissionMutation({ type: 'delete' });
  const isPending =
    createMutation.isPending ||
    editMutation.isPending ||
    deleteMutation.isPending;

  async function savePermission(
    permission: LogicalModelSelectPermissionItem['permission'],
  ) {
    const args = {
      source: 'default',
      name: model.name,
      role,
      permission,
    };
    const result = await execPromiseWithErrorToast(
      () =>
        existing
          ? editMutation.mutateAsync({ args, original: existing.permission })
          : createMutation.mutateAsync({ args }),
      {
        loadingMessage: existing
          ? 'Updating select permission...'
          : 'Creating select permission...',
        successMessage: existing
          ? 'Select permission updated.'
          : 'Select permission created.',
        errorMessage: 'Could not save the select permission.',
      },
    );
    if (result) {
      onBack();
      return true;
    }
    return false;
  }

  async function deletePermission() {
    if (!existing) {
      return false;
    }
    const result = await execPromiseWithErrorToast(
      () =>
        deleteMutation.mutateAsync({
          name: model.name,
          role,
          original: existing.permission,
        }),
      {
        loadingMessage: 'Deleting select permission...',
        successMessage: 'Select permission deleted.',
        errorMessage: 'Could not delete the select permission.',
      },
    );
    if (result) {
      onBack();
      return true;
    }
    return false;
  }

  return (
    <LogicalModelPermissionForm
      model={model}
      models={models}
      role={role}
      availableRoles={availableRoles}
      location={location}
      permission={existing?.permission}
      isPending={isPending}
      onRoleChange={onRoleChange}
      onSubmit={savePermission}
      onDelete={existing ? deletePermission : undefined}
      onCancel={onBack}
    />
  );
}

export default function EditLogicalModelPermissionsForm({
  logicalModelName,
  onCancel,
  location,
}: EditLogicalModelPermissionsFormProps) {
  const [selectedRole, setSelectedRole] = useState<string>();
  const client = useRemoteApplicationGQLClient();
  const {
    data: rolesData,
    loading: rolesLoading,
    error: rolesError,
  } = useGetRemoteAppRolesQuery({ client });
  const {
    data: models = [],
    isLoading: modelsLoading,
    error: modelsError,
  } = useGetLogicalModels();
  if (rolesError) {
    throw rolesError;
  }

  if (modelsError instanceof Error) {
    throw modelsError;
  }

  if (rolesLoading || modelsLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-foreground">
        <Spinner>Loading permissions...</Spinner>
      </div>
    );
  }

  const model = models.find((item) => item.name === logicalModelName);
  if (!model) {
    return (
      <div className="p-6 text-foreground">
        Logical model {logicalModelName} was not found.
      </div>
    );
  }

  const availableRoles = Array.from(
    new Set([
      'public',
      ...(rolesData?.authRoles?.map(({ role }) => role) ?? []),
    ]),
  ).filter((role) => role !== 'admin');
  if (selectedRole) {
    return (
      <LogicalModelPermissionEditor
        key={selectedRole}
        model={model}
        models={models}
        role={selectedRole}
        availableRoles={availableRoles}
        location={location}
        onRoleChange={setSelectedRole}
        onBack={() => setSelectedRole(undefined)}
      />
    );
  }

  return (
    <PermissionsGridLayout onCancel={onCancel}>
      <PermissionsGrid<'select'>
        roles={availableRoles}
        actions={['select']}
        actionLabels={{ select: 'Select' }}
        getAccessLevel={(role) =>
          getPermissionAccess(
            model.select_permissions?.find((item) => item.role === role)
              ?.permission,
          )
        }
        onSelect={(role) => setSelectedRole(role)}
      />
    </PermissionsGridLayout>
  );
}
