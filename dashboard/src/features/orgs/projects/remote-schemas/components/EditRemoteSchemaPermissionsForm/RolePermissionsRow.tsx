import type { ComponentPropsWithoutRef } from 'react';
import { twMerge } from 'tailwind-merge';
import { Button } from '@/components/ui/v3/button';
import { FullPermissionIcon } from '@/components/ui/v3/icons/FullPermissionIcon';
import { NoPermissionIcon } from '@/components/ui/v3/icons/NoPermissionIcon';
import { PartialPermissionIcon } from '@/components/ui/v3/icons/PartialPermissionIcon';
import { TableCell, TableRow } from '@/components/ui/v3/table';
import type { RemoteSchemaAccessLevel } from '@/features/orgs/projects/remote-schemas/types';

export interface RolePermissionsProps extends ComponentPropsWithoutRef<'tr'> {
  /**
   * Role name.
   */
  name: string;
  /**
   * Determines whether or not the actions are disabled.
   */
  disabled?: boolean;
  /**
   * Access level for the role.
   */
  accessLevel?: RemoteSchemaAccessLevel;
  /**
   * Function to be called when the user wants to open the settings for the
   * role.
   */
  onActionSelect?: () => void;
  /**
   * Props passed to individual component slots.
   */
  slotProps?: {
    /**
     * Props passed to every cell in the table row.
     */
    cell?: ComponentPropsWithoutRef<'td'>;
  };
}

function AccessLevelIcon({ level }: { level: RemoteSchemaAccessLevel }) {
  if (level === 'none') {
    return <NoPermissionIcon />;
  }

  if (level === 'partial') {
    return <PartialPermissionIcon />;
  }

  return <FullPermissionIcon />;
}

export default function RolePermissions({
  name,
  disabled,
  accessLevel = 'none',
  onActionSelect,
  slotProps,
  className,
  ...props
}: RolePermissionsProps) {
  const cellProps = slotProps?.cell || {};

  return (
    <TableRow
      className={twMerge(
        'grid grid-cols-2 items-center justify-items-stretch border-b-1',
        className,
      )}
      {...props}
    >
      <TableCell
        {...cellProps}
        className={twMerge(
          'block truncate border-0 border-r-1 p-2',
          cellProps.className,
        )}
      >
        {name}
      </TableCell>

      <TableCell
        {...cellProps}
        className={twMerge(
          'inline-grid h-full w-full items-center border-0 p-0 text-center',
          disabled && 'justify-center',
          cellProps.className,
        )}
      >
        {disabled ? (
          <AccessLevelIcon level={accessLevel} />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-full w-full rounded-none"
            onClick={onActionSelect}
          >
            <AccessLevelIcon level={accessLevel} />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
