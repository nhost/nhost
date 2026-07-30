import { useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { FullPermissionIcon } from '@/components/ui/v3/icons/FullPermissionIcon';
import { NoPermissionIcon } from '@/components/ui/v3/icons/NoPermissionIcon';
import { PartialPermissionIcon } from '@/components/ui/v3/icons/PartialPermissionIcon';
import { Spinner } from '@/components/ui/v3/spinner';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { PermissionsLegend } from '@/features/orgs/projects/common/components/PermissionsLegend';
import LogicalModelPermissionForm from '@/features/orgs/projects/database/native-queries/components/LogicalModelPermissionForm';
import useGetLogicalModels from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import useLogicalModelPermissionMutation from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelPermissionMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useGetRemoteAppRolesQuery } from '@/generated/graphql';
import type {
  LogicalModelItem,
  LogicalModelSelectPermission,
  LogicalModelSelectPermissionItem,
} from '@/utils/hasura-api/generated/schemas';

export interface EditLogicalModelPermissionsFormProps {
  logicalModelName: string;
  onCancel?: VoidFunction;
}

function hasFullAccess(permission: LogicalModelSelectPermission): boolean {
  return (
    permission.columns === '*' &&
    Object.keys(permission.filter ?? {}).length === 0
  );
}

type PermissionAccess = 'full' | 'partial' | 'none';

interface PermissionRow {
  role: string;
  permission?: LogicalModelSelectPermission;
  admin: boolean;
}

function getPermissionAccess({
  permission,
  admin,
}: PermissionRow): PermissionAccess {
  if (admin || (permission && hasFullAccess(permission))) {
    return 'full';
  }
  return permission ? 'partial' : 'none';
}

function PermissionIcon({ access }: { access: PermissionAccess }) {
  if (access === 'full') {
    return <FullPermissionIcon />;
  }
  if (access === 'partial') {
    return <PartialPermissionIcon />;
  }
  return <NoPermissionIcon />;
}

function PermissionGrid({
  rows,
  onSelectRole,
}: {
  rows: PermissionRow[];
  onSelectRole: (role: string) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-2">
        <span className="p-2 text-muted-foreground text-sm">Role</span>
        <span className="p-2 text-center text-muted-foreground text-sm">
          Select
        </span>
      </div>
      <div className="overflow-hidden rounded-sm border">
        {rows.map((row, index) => {
          const access = getPermissionAccess(row);
          const stateLabel = `${access === 'none' ? 'no' : access} access`;
          const cellLabel = `${row.role} select: ${stateLabel}`;
          return (
            <div
              key={row.role}
              className={`grid grid-cols-2 items-stretch ${
                index < rows.length - 1 ? 'border-b' : ''
              }`}
            >
              <span className="truncate border-r p-2 text-sm">{row.role}</span>
              {row.admin ? (
                <span
                  role="img"
                  className="flex items-center justify-center p-2"
                  aria-label={cellLabel}
                >
                  <PermissionIcon access={access} />
                </span>
              ) : (
                <button
                  type="button"
                  className="flex items-center justify-center p-2 hover:bg-muted/50"
                  aria-label={cellLabel}
                  onClick={() => onSelectRole(row.role)}
                >
                  <PermissionIcon access={access} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LogicalModelPermissionEditor({
  model,
  models,
  role,
  onBack,
}: {
  model: LogicalModelItem;
  models: LogicalModelItem[];
  role: string;
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
    }
  }

  async function deletePermission() {
    if (!existing) {
      return;
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
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6 text-foreground">
      <div className="mb-6">
        <h2 className="font-bold">Select permission for {role}</h2>
        <p className="text-muted-foreground text-sm">
          Configure accessible fields and row filters for this role.
        </p>
      </div>
      <LogicalModelPermissionForm
        model={model}
        models={models}
        permission={existing?.permission}
        resetToken={`${model.name}-${role}`}
        isPending={isPending}
        onSubmit={savePermission}
        onDelete={existing ? deletePermission : undefined}
        onCancel={onBack}
        cancelLabel="Back"
      />
    </div>
  );
}

export default function EditLogicalModelPermissionsForm({
  logicalModelName,
  onCancel,
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
        onBack={() => setSelectedRole(undefined)}
      />
    );
  }

  const rows = [
    { role: 'admin', permission: undefined, admin: true },
    ...availableRoles.map((role) => ({
      role,
      permission: model.select_permissions?.find((item) => item.role === role)
        ?.permission,
      admin: false,
    })),
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden border-t bg-background text-foreground">
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div className="space-y-2">
          <h2 className="font-bold">Roles &amp; permissions overview</h2>
          <p className="text-muted-foreground text-sm">
            Click a select permission cell to configure access for that role.
          </p>
        </div>
        <PermissionsLegend />
        <PermissionGrid rows={rows} onSelectRole={setSelectedRole} />
      </div>
      <div className="border-t p-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
