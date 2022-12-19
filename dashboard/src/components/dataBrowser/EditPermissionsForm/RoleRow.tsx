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
  ...props
}: RoleRowProps) {
  const cellProps = slotProps?.cell || {};

  return (
    <TableRow {...props}>
      <TableCell {...cellProps} className={twMerge('p-2', cellProps.className)}>
        {name}
      </TableCell>
      <TableCell
        {...cellProps}
        className={twMerge('p-2 text-center', cellProps.className)}
      >
        {disabled ? (
          <AccessLevelIcon level={accessType.insert} />
        ) : (
          <IconButton
            variant="borderless"
            color="secondary"
            className="w-full h-full"
            onClick={onInsertOperationClick}
          >
            <AccessLevelIcon level={accessType.insert} />
          </IconButton>
        )}
      </TableCell>

      <TableCell
        {...cellProps}
        className={twMerge('p-2 text-center', cellProps.className)}
      >
        {disabled ? (
          <AccessLevelIcon level={accessType.select} />
        ) : (
          <IconButton
            variant="borderless"
            color="secondary"
            className="w-full h-full"
            onClick={onSelectOperationClick}
          >
            <AccessLevelIcon level={accessType.select} />
          </IconButton>
        )}
      </TableCell>

      <TableCell
        {...cellProps}
        className={twMerge('p-2 text-center', cellProps.className)}
      >
        {disabled ? (
          <AccessLevelIcon level={accessType.update} />
        ) : (
          <IconButton
            variant="borderless"
            color="secondary"
            className="w-full h-full"
            onClick={onUpdateOperationClick}
          >
            <AccessLevelIcon level={accessType.update} />
          </IconButton>
        )}
      </TableCell>

      <TableCell
        {...cellProps}
        className={twMerge('p-2 text-center', cellProps.className)}
      >
        {disabled ? (
          <AccessLevelIcon level={accessType.delete} />
        ) : (
          <IconButton
            variant="borderless"
            color="secondary"
            className="w-full h-full"
            onClick={onDeleteOperationClick}
          >
            <AccessLevelIcon level={accessType.delete} />
          </IconButton>
        )}
      </TableCell>
    </TableRow>
  );
}
