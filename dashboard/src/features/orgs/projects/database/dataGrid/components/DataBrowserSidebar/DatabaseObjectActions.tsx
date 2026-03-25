import { Anchor, Ellipsis, SquarePen, Trash2, Users } from 'lucide-react';
import { GraphQLIcon } from '@/components/ui/v2/icons/GraphQLIcon';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { useIsTrackedTable } from '@/features/orgs/projects/database/dataGrid/hooks/useIsTrackedTable';
import type { DatabaseObjectType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { cn } from '@/lib/utils';

const menuItemClassName =
  'flex hover:cursor-pointer hover:bg-data-cell-bg h-9 font-medium items-center justify-start gap-2 rounded-none border border-b-1 text-sm+ leading-4';

const editLabels: Record<DatabaseObjectType, string> = {
  'ORDINARY TABLE': 'Edit Table',
  VIEW: 'Edit View',
  'MATERIALIZED VIEW': 'Edit Materialized View',
  'FOREIGN TABLE': 'Edit Table',
};

const deleteLabels: Record<DatabaseObjectType, string> = {
  'ORDINARY TABLE': 'Delete Table',
  VIEW: 'Delete View',
  'MATERIALIZED VIEW': 'Delete View',
  'FOREIGN TABLE': 'Delete Table',
};

const idPrefixes: Record<DatabaseObjectType, string> = {
  'ORDINARY TABLE': 'table',
  VIEW: 'view',
  'MATERIALIZED VIEW': 'view',
  'FOREIGN TABLE': 'table',
};

type Props = {
  tableName: string;
  schema: string;
  dataSource: string;
  objectType: DatabaseObjectType;
  open: boolean;
  className?: string;
  onOpen: () => void;
  onClose: () => void;
  disabled: boolean;
  isSelectedNotSchemaLocked: boolean;
  onEdit: () => void;
  onEditPermissions: () => void;
  onEditGraphQLSettings: () => void;
  onEditRelationships: () => void;
  onDelete: () => void;
};

function DatabaseObjectActions({
  tableName,
  schema,
  dataSource,
  objectType,
  open,
  className,
  onClose,
  onOpen,
  disabled,
  isSelectedNotSchemaLocked,
  onEdit,
  onEditPermissions,
  onEditGraphQLSettings,
  onEditRelationships,
  onDelete,
}: Props) {
  const { data: isTracked } = useIsTrackedTable({
    dataSource,
    schema,
    tableName,
  });

  function handleOnOpenChange(newOpenState: boolean) {
    if (newOpenState) {
      onOpen();
    } else {
      onClose();
    }
  }

  const idPrefix = idPrefixes[objectType] || 'table';
  const editLabel = editLabels[objectType] || 'Edit';
  const deleteLabel = deleteLabels[objectType] || 'Delete';

  return (
    <DropdownMenu open={open} onOpenChange={handleOnOpenChange}>
      <DropdownMenuTrigger
        className={cn(className)}
        disabled={disabled}
        asChild
      >
        <Button
          id={`${idPrefix}-management-menu-${tableName}`}
          variant="outline"
          size="icon"
          className="h-6 w-6 border-none bg-transparent px-0 hover:bg-transparent"
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="w-52 p-0">
        {isSelectedNotSchemaLocked && (
          <DropdownMenuItem className={menuItemClassName} onClick={onEdit}>
            <SquarePen className="h-4 w-4" /> <span>{editLabel}</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className={cn(menuItemClassName, {
            'italic opacity-50 hover:cursor-default hover:bg-transparent':
              !isTracked,
          })}
          disabled={!isTracked}
          onClick={isTracked ? onEditPermissions : undefined}
        >
          <Users className="h-4 w-4" /> <span>Edit Permissions</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn(menuItemClassName, {
            'italic opacity-50 hover:cursor-default hover:bg-transparent':
              !isTracked,
          })}
          disabled={!isTracked}
          onClick={isTracked ? onEditRelationships : undefined}
        >
          <Anchor className="h-4 w-4" /> <span>Edit Relationships</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className={menuItemClassName}
          onClick={onEditGraphQLSettings}
        >
          <GraphQLIcon className="h-4 w-4" /> <span>Edit GraphQL</span>
        </DropdownMenuItem>
        {isSelectedNotSchemaLocked && (
          <DropdownMenuItem
            className={cn(
              menuItemClassName,
              '!text-sm+ !text-destructive font-medium',
            )}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
            <span>{deleteLabel}</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default DatabaseObjectActions;
