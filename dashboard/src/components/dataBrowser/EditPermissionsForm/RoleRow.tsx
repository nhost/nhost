import IconButton from '@/ui/v2/IconButton';
import FullPermissionIcon from '@/ui/v2/icons/FullPermissionIcon';
import NoPermissionIcon from '@/ui/v2/icons/NoPermissionIcon';
import PartialPermissionIcon from '@/ui/v2/icons/PartialPermissionIcon';
import type { TableCellProps } from '@/ui/v2/TableCell';
import TableCell from '@/ui/v2/TableCell';
import type { TableRowProps } from '@/ui/v2/TableRow';
import TableRow from '@/ui/v2/TableRow';
import { twMerge } from 'tailwind-merge';

type AccessLevel = 'full' | 'partial' | 'none';

export interface RoleRowProps extends TableRowProps {
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
  accessType?: Record<'insert' | 'select' | 'update' | 'delete', AccessLevel>;
  /**
   * Function to be called when the user wants to open the settings for the
   * insert operation.
   */
  onInsertOperationClick?: VoidFunction;
  /**
   * Function to be called when the user wants to open the settings for the
   * select operation.
   */
  onSelectOperationClick?: VoidFunction;
  /**
   * Function to be called when the user wants to open the settings for the
   * update operation.
   */
  onUpdateOperationClick?: VoidFunction;
  /**
   * Function to be called when the user wants to open the settings for the
   * delete operation.
   */
  onDeleteOperationClick?: VoidFunction;
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

function AccessLevelIcon({ level }: { level: AccessLevel }) {
  if (level === 'none') {
    return <NoPermissionIcon />;
  }

  if (level === 'partial') {
    return <PartialPermissionIcon />;
  }

  return <FullPermissionIcon />;
}

export default function RoleRow({
  name,
  disabled,
  accessType = {
    insert: 'none',
    select: 'none',
    update: 'none',
    delete: 'none',
  },
  onInsertOperationClick,
  onSelectOperationClick,
  onUpdateOperationClick,
  onDeleteOperationClick,
  slotProps,
  className,
  ...props
}: RoleRowProps) {
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
          <AccessLevelIcon level={accessType.insert} />
        ) : (
          <IconButton
            variant="borderless"
            color="secondary"
            className="w-full h-full rounded-none"
            onClick={onInsertOperationClick}
          >
            <AccessLevelIcon level={accessType.insert} />
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
          <AccessLevelIcon level={accessType.select} />
        ) : (
          <IconButton
            variant="borderless"
            color="secondary"
            className="w-full h-full rounded-none"
            onClick={onSelectOperationClick}
          >
            <AccessLevelIcon level={accessType.select} />
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
          <AccessLevelIcon level={accessType.update} />
        ) : (
          <IconButton
            variant="borderless"
            color="secondary"
            className="w-full h-full rounded-none"
            onClick={onUpdateOperationClick}
          >
            <AccessLevelIcon level={accessType.update} />
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
          <AccessLevelIcon level={accessType.delete} />
        ) : (
          <IconButton
            variant="borderless"
            color="secondary"
            className="w-full h-full rounded-none"
            onClick={onDeleteOperationClick}
          >
            <AccessLevelIcon level={accessType.delete} />
          </IconButton>
        )}
      </TableCell>
    </TableRow>
  );
}
