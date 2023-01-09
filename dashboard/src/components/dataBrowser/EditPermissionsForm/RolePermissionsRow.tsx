import type { DatabaseAccessLevel, DatabaseAction } from '@/types/dataBrowser';
import IconButton from '@/ui/v2/IconButton';
import FullPermissionIcon from '@/ui/v2/icons/FullPermissionIcon';
import NoPermissionIcon from '@/ui/v2/icons/NoPermissionIcon';
import PartialPermissionIcon from '@/ui/v2/icons/PartialPermissionIcon';
import type { TableCellProps } from '@/ui/v2/TableCell';
import TableCell from '@/ui/v2/TableCell';
import type { TableRowProps } from '@/ui/v2/TableRow';
import TableRow from '@/ui/v2/TableRow';
import { twMerge } from 'tailwind-merge';

export interface RolePermissionsProps extends TableRowProps {
  /**
   * Role name.
   */
  name: string;
  /**
   * Determines whether or not the actions are disabled.
   */
  disabled?: boolean;
  /**
   * Access types for specific operations.
   */
  accessLevels?: Record<DatabaseAction, DatabaseAccessLevel>;
  /**
   * Function to be called when the user wants to open the settings for an
   * operation.
   */
  onActionSelect?: (action: DatabaseAction) => void;
  /**
   * Props passed to individual component slots.
   */
  slotProps?: {
    /**
     * Props passed to every cell in the table row.
     */
    cell?: Partial<TableCellProps>;
  };
}

function AccessLevelIcon({ level }: { level: DatabaseAccessLevel }) {
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
  accessLevels = {
    insert: 'none',
    select: 'none',
    update: 'none',
    delete: 'none',
  },
  onActionSelect,
  slotProps,
  className,
  ...props
}: RolePermissionsProps) {
  const cellProps = slotProps?.cell || {};

  return (
    <TableRow
      className={twMerge(
        'grid grid-cols-5 items-center justify-items-stretch border-b-1',
        className,
      )}
      {...props}
    >
      <TableCell
        {...cellProps}
        className={twMerge(
          'block p-2 border-0 truncate border-r-1',
          cellProps.className,
        )}
      >
        {name}
      </TableCell>

      <TableCell
        {...cellProps}
        className={twMerge(
          'inline-grid items-center p-0 border-0 text-center w-full h-full border-r-1',
          disabled && 'justify-center',
          cellProps.className,
        )}
      >
        {disabled ? (
          <AccessLevelIcon level={accessLevels.insert} />
        ) : (
          <IconButton
            variant="borderless"
            color="secondary"
            className="w-full h-full rounded-none"
            onClick={() => onActionSelect('insert')}
          >
            <AccessLevelIcon level={accessLevels.insert} />
          </IconButton>
        )}
      </TableCell>

      <TableCell
        {...cellProps}
        className={twMerge(
          'inline-grid items-center p-0 border-0 text-center w-full h-full border-r-1',
          disabled && 'justify-center',
          cellProps.className,
        )}
      >
        {disabled ? (
          <AccessLevelIcon level={accessLevels.select} />
        ) : (
          <IconButton
            variant="borderless"
            color="secondary"
            className="w-full h-full rounded-none"
            onClick={() => onActionSelect('select')}
          >
            <AccessLevelIcon level={accessLevels.select} />
          </IconButton>
        )}
      </TableCell>

      <TableCell
        {...cellProps}
        className={twMerge(
          'inline-grid items-center p-0 border-0 text-center w-full h-full border-r-1',
          disabled && 'justify-center',
          cellProps.className,
        )}
      >
        {disabled ? (
          <AccessLevelIcon level={accessLevels.update} />
        ) : (
          <IconButton
            variant="borderless"
            color="secondary"
            className="w-full h-full rounded-none"
            onClick={() => onActionSelect('update')}
          >
            <AccessLevelIcon level={accessLevels.update} />
          </IconButton>
        )}
      </TableCell>

      <TableCell
        {...cellProps}
        className={twMerge(
          'inline-grid items-center p-0 border-0 text-center w-full h-full',
          disabled && 'justify-center',
          cellProps.className,
        )}
      >
        {disabled ? (
          <AccessLevelIcon level={accessLevels.delete} />
        ) : (
          <IconButton
            variant="borderless"
            color="secondary"
            className="w-full h-full rounded-none"
            onClick={() => onActionSelect('delete')}
          >
            <AccessLevelIcon level={accessLevels.delete} />
          </IconButton>
        )}
      </TableCell>
    </TableRow>
  );
}
