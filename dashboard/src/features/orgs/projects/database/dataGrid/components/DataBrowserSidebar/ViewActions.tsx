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
  onEditPermissions: () => void;
  onViewPermissions: () => void;
  onEditView: () => void;
  onEditGraphQLSettings: () => void;
  onViewGraphQLSettings: () => void;
  onEditRelationships: () => void;
  onViewRelationships: () => void;
  onDelete: () => void;
};

function ViewActions({
  tableName,
  schema,
  dataSource,
  open,
  className,
  onClose,
  onOpen,
  disabled,
  isSelectedNotSchemaLocked,
  onEditPermissions,
  onViewPermissions,
  onEditView,
  onEditGraphQLSettings,
  onViewGraphQLSettings,
  onEditRelationships,
  onViewRelationships,
  onDelete,
}: Props) {
  const { project } = useProject();
  const isGitHubConnected = !!project?.githubRepository;
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
  return (
    <DropdownMenu open={open} onOpenChange={handleOnOpenChange}>
      <DropdownMenuTrigger
        className={cn(className)}
        disabled={disabled}
        asChild
      >
        <Button
          id={`view-management-menu-${tableName}`}
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
                  !isTracked,
              })}
              disabled={!isTracked}
              onClick={isTracked ? onViewPermissions : undefined}
            >
              <Users className="h-4 w-4" /> <span>View Permissions</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className={cn(menuItemClassName, {
                'italic opacity-50 hover:cursor-default hover:bg-transparent':
                  !isTracked,
              })}
              disabled={!isTracked}
              onClick={isTracked ? onViewRelationships : undefined}
            >
              <Anchor className="h-4 w-4" /> <span>View Relationships</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className={menuItemClassName}
              onClick={onViewGraphQLSettings}
            >
              <GraphQLIcon className="h-4 w-4" /> <span>View GraphQL</span>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            {isSelectedNotSchemaLocked && (
              <DropdownMenuItem
                className={menuItemClassName}
                onClick={onEditView}
              >
                <SquarePen className="h-4 w-4" /> <span>View Definition</span>
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
                <span>Delete View</span>
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ViewActions;
