import IconButton from '@/ui/v2/IconButton';
import FullPermissionIcon from '@/ui/v2/icons/FullPermissionIcon';
import NoPermissionIcon from '@/ui/v2/icons/NoPermissionIcon';
import PartialPermissionIcon from '@/ui/v2/icons/PartialPermissionIcon';
import TableCell from '@/ui/v2/TableCell';
import type { TableRowProps } from '@/ui/v2/TableRow';
import TableRow from '@/ui/v2/TableRow';

export interface RoleRowProps extends TableRowProps {
  /**
   * Role name.
   */
  name: string;
  /**
   * Access types for specific operations.
   */
  accessType?: Record<
    'insert' | 'select' | 'update' | 'delete',
    'full' | 'partial' | 'none'
  >;
}

export default function RoleRow({
  name,
  accessType = {
    insert: 'none',
    select: 'none',
    update: 'none',
    delete: 'none',
  },
  ...props
}: RoleRowProps) {
  return (
    <TableRow {...props}>
      <TableCell className="p-2">{name}</TableCell>
      <TableCell className="p-2 text-center">
        <IconButton
          variant="borderless"
          color="secondary"
          className="w-full h-full"
        >
          {accessType.insert === 'full' && <FullPermissionIcon />}
          {accessType.insert === 'partial' && <PartialPermissionIcon />}
          {accessType.insert === 'none' && <NoPermissionIcon />}
        </IconButton>
      </TableCell>

      <TableCell className="p-2 text-center">
        <IconButton
          variant="borderless"
          color="secondary"
          className="w-full h-full"
        >
          {accessType.select === 'full' && <FullPermissionIcon />}
          {accessType.select === 'partial' && <PartialPermissionIcon />}
          {accessType.select === 'none' && <NoPermissionIcon />}
        </IconButton>
      </TableCell>

      <TableCell className="p-2 text-center">
        <IconButton
          variant="borderless"
          color="secondary"
          className="w-full h-full"
        >
          {accessType.update === 'full' && <FullPermissionIcon />}
          {accessType.update === 'partial' && <PartialPermissionIcon />}
          {accessType.update === 'none' && <NoPermissionIcon />}
        </IconButton>
      </TableCell>

      <TableCell className="p-2 text-center">
        <IconButton
          variant="borderless"
          color="secondary"
          className="w-full h-full"
        >
          {accessType.delete === 'full' && <FullPermissionIcon />}
          {accessType.delete === 'partial' && <PartialPermissionIcon />}
          {accessType.delete === 'none' && <NoPermissionIcon />}
        </IconButton>
      </TableCell>
    </TableRow>
  );
}
