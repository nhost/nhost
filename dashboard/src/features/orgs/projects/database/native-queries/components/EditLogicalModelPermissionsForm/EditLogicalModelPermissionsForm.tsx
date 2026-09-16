import { useState } from 'react';
import {
  type AccessLevel,
  PermissionsGrid,
} from '@/components/common/PermissionsGrid';
import { PermissionsGridLayout } from '@/components/common/PermissionsGridLayout';
import { Spinner } from '@/components/ui/v3/spinner';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { LogicalModelPermissionForm } from '@/features/orgs/projects/database/native-queries/components/LogicalModelPermissionForm';
import { useGetLogicalModels } from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import { useGetRemoteAppRolesQuery } from '@/generated/graphql';
import type { DialogFormProps } from '@/types/common';
import type { LogicalModelSelectPermission } from '@/utils/hasura-api/generated/schemas';

export interface EditLogicalModelPermissionsFormProps extends DialogFormProps {
  source: string;
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

export default function EditLogicalModelPermissionsForm({
  source,
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
      <LogicalModelPermissionForm
        key={`${source}:${selectedRole}`}
        source={source}
        model={model}
        models={models}
        role={selectedRole}
        availableRoles={availableRoles}
        location={location}
        onRoleChange={setSelectedRole}
        onCancel={() => setSelectedRole(undefined)}
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
