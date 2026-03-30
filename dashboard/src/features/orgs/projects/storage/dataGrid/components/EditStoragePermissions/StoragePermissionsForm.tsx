import { useState } from 'react';
import { NavLink } from '@/components/common/NavLink';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useMetadataQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { DialogFormProps } from '@/types/common';
import { useGetRemoteAppRolesQuery } from '@/utils/__generated__/graphql';

import type { PermissionsByDbAction } from './StoragePermissionsGrid';
import StoragePermissionsGrid, {
  findPermission,
} from './StoragePermissionsGrid';
import StorageRolePermissionEditorForm from './StorageRolePermissionEditorForm';
import { STORAGE_SCHEMA, STORAGE_TABLE, type StorageAction } from './types';

export interface StoragePermissionsFormProps extends DialogFormProps {
  disabled?: boolean;
  onCancel?: VoidFunction;
}

export default function StoragePermissionsForm({
  disabled,
  onCancel,
  location,
}: StoragePermissionsFormProps) {
  const [selectedRole, setSelectedRole] = useState<string>();
  const [selectedAction, setSelectedAction] = useState<StorageAction>();

  const { project } = useProject();
  const { org } = useCurrentOrg();

  const client = useRemoteApplicationGQLClient();
  const {
    data: rolesData,
    loading: rolesLoading,
    error: rolesError,
  } = useGetRemoteAppRolesQuery({ client });

  const {
    data: metadata,
    status: metadataStatus,
    error: metadataError,
  } = useMetadataQuery(['default.metadata'], { dataSource: 'default' });

  if (metadataStatus === 'loading' || rolesLoading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  if (metadataError) {
    throw metadataError;
  }

  if (rolesError) {
    throw rolesError;
  }

  const availableRoles = [
    'public',
    ...(rolesData?.authRoles?.map(({ role }) => role) || []),
  ];

  const metadataForTable = metadata?.tables?.find(
    ({ table }) =>
      table.name === STORAGE_TABLE && table.schema === STORAGE_SCHEMA,
  );

  const permissions: PermissionsByDbAction = {
    insert: metadataForTable?.insert_permissions,
    select: metadataForTable?.select_permissions,
    update: metadataForTable?.update_permissions,
    delete: metadataForTable?.delete_permissions,
  };

  function resetSelection() {
    setSelectedRole(undefined);
    setSelectedAction(undefined);
  }

  if (selectedRole && selectedAction) {
    return (
      <StorageRolePermissionEditorForm
        location={location}
        resourceVersion={metadata?.resourceVersion as number}
        disabled={disabled}
        role={selectedRole}
        storageAction={selectedAction}
        onSubmit={resetSelection}
        onCancel={resetSelection}
        permission={findPermission(permissions, selectedAction, selectedRole)}
      />
    );
  }

  return (
    <div className="flex flex-auto flex-col content-between overflow-hidden border-t-1">
      <div className="flex-auto overflow-y-auto border-b-1 p-6">
        <div className="grid grid-flow-row content-start gap-6">
          <div className="grid gap-2">
            <h2 className="font-bold text-sm">Roles & Actions overview</h2>
            <p className="text-muted-foreground text-sm">
              A checkmark indicates the role has permission to perform the
              operation. Click a cell to view or edit permission rules.
            </p>
          </div>

          <StoragePermissionsGrid
            roles={availableRoles}
            permissions={permissions}
            onSelect={(role, action) => {
              setSelectedRole(role);
              setSelectedAction(action);
            }}
          />

          <p className="text-muted-foreground text-sm">
            Please go to the{' '}
            <NavLink
              href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/roles-and-permissions`}
              className="px-0 underline"
            >
              Settings page
            </NavLink>{' '}
            to add and delete roles.
          </p>
        </div>
      </div>

      <div className="flex flex-shrink-0 justify-between gap-3 border-t-1 p-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
