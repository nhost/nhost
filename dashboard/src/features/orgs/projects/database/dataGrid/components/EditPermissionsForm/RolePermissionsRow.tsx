import { twMerge } from 'tailwind-merge';
import { IconButton } from '@/components/ui/v2/IconButton';
import { FullPermissionIcon } from '@/components/ui/v2/icons/FullPermissionIcon';
import { NoPermissionIcon } from '@/components/ui/v2/icons/NoPermissionIcon';
import { PartialPermissionIcon } from '@/components/ui/v2/icons/PartialPermissionIcon';
import type { TableCellProps } from '@/components/ui/v2/TableCell';
import { TableCell } from '@/components/ui/v2/TableCell';
import type { TableRowProps } from '@/components/ui/v2/TableRow';
import { TableRow } from '@/components/ui/v2/TableRow';
import type {
  DatabaseAccessLevel,
  DatabaseAction,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

const ALL_ACTIONS: DatabaseAction[] = ['insert', 'select', 'update', 'delete'];

const gridColsMap: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  5: 'grid-cols-5',
};

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
   * The actions to display. Defaults to all 4 actions.
   */
  actions?: DatabaseAction[];
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
  actions = ALL_ACTIONS,
  slotProps,
  className,
  ...props
}: RolePermissionsProps) {
  const cellProps = slotProps?.cell || {};
  const gridCols = gridColsMap[actions.length + 1] || 'grid-cols-5';

  return (
    <TableRow
      className={twMerge(
        `grid ${gridCols} items-center justify-items-stretch border-b-1`,
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

      {actions.map((actionKey, index) => (
        <TableCell
          key={actionKey}
          {...cellProps}
          className={twMerge(
            'inline-grid h-full w-full items-center border-0 p-0 text-center',
            index < actions.length - 1 && 'border-r-1',
            disabled && 'justify-center',
            cellProps.className,
          )}
        >
          {disabled ? (
            <AccessLevelIcon level={accessLevels[actionKey]} />
          ) : (
            <IconButton
              variant="borderless"
              color="secondary"
              className="h-full w-full rounded-none"
              onClick={() => onActionSelect?.(actionKey)}
            >
              <AccessLevelIcon level={accessLevels[actionKey]} />
            </IconButton>
          )}
        </TableCell>
      ))}
    </TableRow>
  );
}
