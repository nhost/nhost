import { Check, Plus } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

import type { HasuraMetadataPermission } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

import {
  STORAGE_ACTION_LABELS,
  STORAGE_ACTION_TO_DB_ACTION,
  STORAGE_ACTIONS,
  type StorageAction,
} from './types';

export interface PermissionsByDbAction {
  insert: HasuraMetadataPermission[] | undefined;
  select: HasuraMetadataPermission[] | undefined;
  update: HasuraMetadataPermission[] | undefined;
  delete: HasuraMetadataPermission[] | undefined;
}

export function findPermission(
  permissions: PermissionsByDbAction,
  action: StorageAction,
  role: string,
): HasuraMetadataPermission['permission'] | undefined {
  const dbAction = STORAGE_ACTION_TO_DB_ACTION[action];
  return permissions[dbAction]?.find(({ role: r }) => r === role)?.permission;
}

function PermissionCell({
  hasPermission,
  onClick,
}: {
  hasPermission: boolean;
  onClick: VoidFunction;
}) {
  return (
    <td className="flex items-center justify-center border-r p-0 last:border-r-0">
      <button
        type="button"
        className="flex h-full w-full items-center justify-center gap-1.5 p-2 hover:bg-accent"
        onClick={onClick}
      >
        {hasPermission ? (
          <Check className="h-4 w-4" />
        ) : (
          <Plus className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
    </td>
  );
}

function RoleRow({
  role,
  permissions,
  isLast,
  onSelect,
}: {
  role: string;
  permissions: PermissionsByDbAction;
  isLast: boolean;
  onSelect: (action: StorageAction) => void;
}) {
  return (
    <tr className={twMerge('grid grid-cols-5', !isLast && 'border-b')}>
      <td className="border-r p-2">{role}</td>
      {STORAGE_ACTIONS.map((action) => (
        <PermissionCell
          key={action}
          hasPermission={Boolean(findPermission(permissions, action, role))}
          onClick={() => onSelect(action)}
        />
      ))}
    </tr>
  );
}

function AdminRow() {
  return (
    <tr className="grid grid-cols-5 border-b">
      <td className="border-r p-2">admin</td>
      {STORAGE_ACTIONS.map((action) => (
        <td key={action} className="flex items-center justify-center p-2">
          <Check className="h-4 w-4 text-muted-foreground" />
        </td>
      ))}
    </tr>
  );
}

export default function StoragePermissionsGrid({
  roles,
  permissions,
  onSelect,
}: {
  roles: string[];
  permissions: PermissionsByDbAction;
  onSelect: (role: string, action: StorageAction) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="grid grid-cols-5 border-b">
            <th className="p-2 text-left font-medium">Role</th>
            {STORAGE_ACTIONS.map((action) => (
              <th key={action} className="p-2 text-center font-medium">
                {STORAGE_ACTION_LABELS[action]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <AdminRow />
          {roles.map((role, index) => (
            <RoleRow
              key={role}
              role={role}
              permissions={permissions}
              isLast={index === roles.length - 1}
              onSelect={(action) => onSelect(role, action)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
