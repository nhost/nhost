import { twMerge } from 'tailwind-merge';
import { FullPermissionIcon } from '@/components/ui/v3/icons/FullPermissionIcon';
import { NoPermissionIcon } from '@/components/ui/v3/icons/NoPermissionIcon';
import { PartialPermissionIcon } from '@/components/ui/v3/icons/PartialPermissionIcon';
import type { DatabaseAction } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export type AccessLevel = 'full' | 'partial' | 'none';

export interface PermissionsGridProps {
  roles: string[];
  actions: DatabaseAction[];
  actionLabels: Record<DatabaseAction, string>;
  getAccessLevel: (role: string, action: DatabaseAction) => AccessLevel;
  onSelect: (role: string, action: DatabaseAction) => void;
}

const gridColsMap: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
};

function AccessLevelIcon({ level }: { level: AccessLevel }) {
  if (level === 'none') {
    return <NoPermissionIcon />;
  }

  if (level === 'partial') {
    return <PartialPermissionIcon />;
  }

  return <FullPermissionIcon />;
}

export default function PermissionsGrid({
  roles,
  actions,
  actionLabels,
  getAccessLevel,
  onSelect,
}: PermissionsGridProps) {
  const gridCols = gridColsMap[actions.length + 1] || 'grid-cols-5';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="block">
          <tr className={`grid ${gridCols} items-center`}>
            <th className="p-2 text-left font-medium">Role</th>
            {actions.map((action) => (
              <th key={action} className="p-2 text-center font-medium">
                {actionLabels[action]}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="block rounded-sm+ border-1">
          <tr
            className={`grid ${gridCols} items-center justify-items-stretch border-b-1`}
          >
            <td className="block truncate border-r-1 p-2">admin</td>
            {actions.map((action, index) => (
              <td
                key={action}
                className={twMerge(
                  'inline-grid h-full w-full items-center justify-center p-0 text-center',
                  index < actions.length - 1 && 'border-r-1',
                )}
              >
                <AccessLevelIcon level="full" />
              </td>
            ))}
          </tr>

          {roles.map((role, roleIndex) => (
            <tr
              key={role}
              className={twMerge(
                `grid ${gridCols} items-center justify-items-stretch border-b-1`,
                roleIndex === roles.length - 1 && 'border-b-0',
              )}
            >
              <td className="block truncate border-r-1 p-2">{role}</td>
              {actions.map((action, actionIndex) => (
                <td
                  key={action}
                  className={twMerge(
                    'inline-grid h-full w-full items-center p-0 text-center',
                    actionIndex < actions.length - 1 && 'border-r-1',
                  )}
                >
                  <button
                    type="button"
                    className="flex h-full w-full items-center justify-center rounded-none hover:bg-accent"
                    onClick={() => onSelect(role, action)}
                  >
                    <AccessLevelIcon level={getAccessLevel(role, action)} />
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
