import { SiGraphql as GraphQLIcon } from '@icons-pack/react-simple-icons';
import { Anchor, Ellipsis, Pencil, Trash2, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import type { DatabaseObjectType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { cn } from '@/lib/utils';

const menuItemClassName = 'cursor-pointer gap-2';

const editLabels: Record<DatabaseObjectType, string> = {
  'ORDINARY TABLE': 'Edit Table',
  VIEW: 'Edit View',
  'MATERIALIZED VIEW': 'Edit Materialized View',
  'FOREIGN TABLE': 'Edit Table',
  FUNCTION: 'Edit Function',
};

const deleteLabels: Record<DatabaseObjectType, string> = {
  'ORDINARY TABLE': 'Delete Table',
  VIEW: 'Delete View',
  'MATERIALIZED VIEW': 'Delete View',
  'FOREIGN TABLE': 'Delete Table',
  FUNCTION: 'Delete Function',
};

const idPrefixes: Record<DatabaseObjectType, string> = {
  'ORDINARY TABLE': 'table',
  VIEW: 'view',
  'MATERIALIZED VIEW': 'view',
  'FOREIGN TABLE': 'table',
  FUNCTION: 'function',
};

type Props = {
  objectName: string;
  objectType: DatabaseObjectType;
  isUntracked: boolean;
  open: boolean;
  className?: string;
  triggerClassName?: string;
  triggerIcon?: ReactNode;
  onOpen: () => void;
  onClose: () => void;
  disabled: boolean;
  isSelectedNotSchemaLocked: boolean;
  onEdit: () => void;
  onEditPermissions?: () => void;
  onEditGraphQLSettings: () => void;
  onEditRelationships?: () => void;
  onDelete: () => void;
};

function DatabaseObjectActions({
  objectName,
  objectType,
  isUntracked,
  open,
  className,
  triggerClassName,
  triggerIcon,
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
  const hasRelationships = objectType !== 'FUNCTION';

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
    <DropdownMenu open={open} onOpenChange={handleOnOpenChange} modal={false}>
      <DropdownMenuTrigger
        className={cn(className)}
        disabled={disabled}
        asChild
      >
        <Button
          data-testid={`${idPrefix}-management-menu-${objectName}`}
          variant="outline"
          size="icon"
          className={cn(
            'h-6 w-6 border-none bg-transparent px-0 hover:bg-transparent',
            triggerClassName,
          )}
        >
          {triggerIcon ?? <Ellipsis />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="w-52">
        {isSelectedNotSchemaLocked && (
          <DropdownMenuItem className={menuItemClassName} onClick={onEdit}>
            <Pencil className="h-4 w-4" /> <span>{editLabel}</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className={cn(menuItemClassName, {
            'italic opacity-50 hover:cursor-default hover:bg-transparent':
              isUntracked,
          })}
          disabled={isUntracked}
          onClick={onEditPermissions}
        >
          <Users className="h-4 w-4" /> <span>Edit Permissions</span>
        </DropdownMenuItem>
        {hasRelationships && (
          <DropdownMenuItem
            className={cn(menuItemClassName, {
              'italic opacity-50 hover:cursor-default hover:bg-transparent':
                isUntracked,
            })}
            disabled={isUntracked}
            onClick={onEditRelationships}
          >
            <Anchor className="h-4 w-4" /> <span>Edit Relationships</span>
          </DropdownMenuItem>
        )}
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
              'text-destructive focus:bg-destructive-hover focus:text-destructive',
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
