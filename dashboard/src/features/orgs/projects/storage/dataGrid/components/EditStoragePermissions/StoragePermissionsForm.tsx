import { useState } from 'react';
import {
  findPermission,
  PermissionsGrid,
} from '@/components/common/PermissionsGrid';
import { PermissionsGridLayout } from '@/components/common/PermissionsGridLayout';
import { Spinner } from '@/components/ui/v3/spinner';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useMetadataQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery';
import type { DatabaseAction } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import type { DialogFormProps } from '@/types/common';
import { useGetRemoteAppRolesQuery } from '@/utils/__generated__/graphql';
import StorageRolePermissionEditorForm from './StorageRolePermissionEditorForm';
import {
  DB_ACTION_TO_STORAGE_ACTION,
  STORAGE_ACTION_TO_DB_ACTION,
  STORAGE_SCHEMA,
  STORAGE_TABLE,
  type StorageAction,
} from './types';
import { hasRequiredColumns } from './utils';

const DB_ACTIONS: DatabaseAction[] = ['insert', 'select', 'update', 'delete'];

export interface StoragePermissionsFormProps extends DialogFormProps {
  onCancel?: VoidFunction;
}

export default function StoragePermissionsForm({
  onCancel,
  location,
}: StoragePermissionsFormProps) {
  const [selectedRole, setSelectedRole] = useState<string>();
  const [selectedAction, setSelectedAction] = useState<StorageAction>();

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
      <div className="flex items-center justify-center p-6">
        <Spinner />
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

  const storageActionLabels: Record<DatabaseAction, string> = {
    insert: 'Upload',
    select: 'Download',
    update: 'Replace',
    delete: 'Delete',
  };

  function getAccessLevel(role: string, action: DatabaseAction) {
    const permission = findPermission(metadataForTable, role, action);
    if (isEmptyValue(permission)) {
      return 'none' as const;
    }
    const storageAction = DB_ACTION_TO_STORAGE_ACTION[action];
    if (!hasRequiredColumns(storageAction, permission)) {
      return 'none' as const;
    }
    const hasChecks =
      isNotEmptyValue(permission?.check) || isNotEmptyValue(permission?.filter);
    return hasChecks ? ('partial' as const) : ('full' as const);
  }

  function resetSelection() {
    setSelectedRole(undefined);
    setSelectedAction(undefined);
  }

  if (selectedRole && selectedAction) {
    const dbAction = STORAGE_ACTION_TO_DB_ACTION[selectedAction];
    return (
      <StorageRolePermissionEditorForm
        key={`${selectedRole}.${selectedAction}`}
        location={location}
        resourceVersion={metadata?.resourceVersion as number}
        role={selectedRole}
        storageAction={selectedAction}
        availableRoles={availableRoles}
        availableStorageActions={
          Object.values(DB_ACTION_TO_STORAGE_ACTION) as StorageAction[]
        }
        onRoleChange={setSelectedRole}
        onStorageActionChange={setSelectedAction}
        onSubmit={resetSelection}
        onCancel={resetSelection}
        permission={findPermission(metadataForTable, selectedRole, dbAction)}
      />
    );
  }

  return (
    <PermissionsGridLayout onCancel={onCancel}>
      <PermissionsGrid
        roles={availableRoles}
        actions={DB_ACTIONS}
        actionLabels={storageActionLabels}
        getAccessLevel={getAccessLevel}
        onSelect={(role, dbAction) => {
          setSelectedRole(role);
          setSelectedAction(DB_ACTION_TO_STORAGE_ACTION[dbAction]);
        }}
      />
    </PermissionsGridLayout>
  );
}
