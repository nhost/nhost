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
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { cn } from '@/lib/utils';

const menuItemClassName =
  'flex hover:cursor-pointer hover:bg-data-cell-bg h-9 font-medium items-center justify-start gap-2 rounded-none border border-b-1 text-sm+ leading-4';

type Props = {
  tableName: string;
  schema: string;
  dataSource: string;
  open: boolean;
  className?: string;
  onOpen: () => void;
  onClose: () => void;
  disabled: boolean;
  isSelectedNotSchemaLocked: boolean;
  onDelete: () => void;
  onEditPermissions: () => void;
  onViewPermissions: () => void;
  onEditTable: () => void;
  onEditSettings: () => void;
  onViewSettings: () => void;
  onEditRelationships: () => void;
  onViewRelationships: () => void;
};

function TableActions({
  tableName,
  schema,
  dataSource,
  open,
  className,
  onClose,
  onOpen,
  disabled,
  isSelectedNotSchemaLocked,
  onDelete,
  onEditPermissions,
  onViewPermissions,
  onEditTable,
  onEditSettings,
  onViewSettings,
  onEditRelationships,
  onViewRelationships,
}: Props) {
  const { project } = useProject();
  const isGitHubConnected = !!project?.githubRepository;
  const { data: isTrackedTable } = useIsTrackedTable({
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
  return (
    <DropdownMenu open={open} onOpenChange={handleOnOpenChange}>
      <DropdownMenuTrigger
        className={cn(className)}
        disabled={disabled}
        asChild
      >
        <Button
          id={`table-management-menu-${tableName}`}
          variant="outline"
          size="icon"
          className="h-6 w-6 border-none bg-transparent px-0 hover:bg-transparent"
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="w-52 p-0">
        {isGitHubConnected ? (
          <>
            <DropdownMenuItem
              className={cn(menuItemClassName, {
                'italic opacity-50 hover:cursor-default hover:bg-transparent':
                  !isTrackedTable,
              })}
              disabled={!isTrackedTable}
              onClick={isTrackedTable ? onViewPermissions : undefined}
            >
              <Users className="h-4 w-4" /> <span>View Permissions</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className={cn(menuItemClassName, {
                'italic opacity-50 hover:cursor-default hover:bg-transparent':
                  !isTrackedTable,
              })}
              disabled={!isTrackedTable}
              onClick={isTrackedTable ? onViewRelationships : undefined}
            >
              <Anchor className="h-4 w-4" /> <span>View Relationships</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className={menuItemClassName}
              onClick={onViewSettings}
            >
              <GraphQLIcon className="h-4 w-4" /> <span>View GraphQL</span>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            {isSelectedNotSchemaLocked && (
              <DropdownMenuItem
                className={menuItemClassName}
                onClick={onEditTable}
              >
                <SquarePen className="h-4 w-4" /> <span>Edit Table</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className={cn(menuItemClassName, {
                'italic opacity-50 hover:cursor-default hover:bg-transparent':
                  !isTrackedTable,
              })}
              disabled={!isTrackedTable}
              onClick={isTrackedTable ? onEditPermissions : undefined}
            >
              <Users className="h-4 w-4" /> <span>Edit Permissions</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className={cn(menuItemClassName, {
                'italic opacity-50 hover:cursor-default hover:bg-transparent':
                  !isTrackedTable,
              })}
              disabled={!isTrackedTable}
              onClick={isTrackedTable ? onEditRelationships : undefined}
            >
              <Anchor className="h-4 w-4" /> <span>Edit Relationships</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className={menuItemClassName}
              onClick={onEditSettings}
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
                <span>Delete Table</span>
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default TableActions;
