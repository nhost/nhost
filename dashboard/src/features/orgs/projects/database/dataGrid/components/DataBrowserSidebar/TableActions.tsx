import { Ellipsis, Settings, SquarePen, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { cn } from '@/lib/utils';

const menuItemClassName =
  'flex hover:cursor-pointer hover:bg-data-cell-bg h-9 font-medium items-center justify-start gap-2 rounded-none border border-b-1 text-sm+ leading-4';

type Props = {
  tableName: string;
  open: boolean;
  className?: string;
  onOpen: () => void;
  onClose: () => void;
  disabled: boolean;
  isSelectedNotSchemaLocked: boolean;
  isMaterializedView?: boolean;
  isFunction?: boolean;
  onDelete: () => void;
  onEditPermissions: () => void;
  onViewPermissions: () => void;
  onEditTable: () => void;
  onEditSettings: () => void;
  onViewSettings: () => void;
};

function TableActions({
  tableName,
  open,
  className,
  onClose,
  onOpen,
  disabled,
  isSelectedNotSchemaLocked,
  isMaterializedView = false,
  isFunction = false,
  onDelete,
  onEditPermissions,
  onViewPermissions,
  onEditTable,
  onEditSettings,
  onViewSettings,
}: Props) {
  const { project } = useProject();
  const isGitHubConnected = !!project?.githubRepository;

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
              className={menuItemClassName}
              onClick={onViewPermissions}
            >
              <Users className="h-4 w-4" /> <span>View Permissions</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className={menuItemClassName}
              onClick={onViewSettings}
            >
              <Settings className="h-4 w-4" /> <span>View Settings</span>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            {isSelectedNotSchemaLocked && !isFunction && (
              <DropdownMenuItem
                className={menuItemClassName}
                onClick={onEditTable}
              >
                <SquarePen className="h-4 w-4" /> <span>Edit Table</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className={menuItemClassName}
              onClick={onEditPermissions}
            >
              <Users className="h-4 w-4" /> <span>Edit Permissions</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className={menuItemClassName}
              onClick={onEditSettings}
            >
              <Settings className="h-4 w-4" /> <span>Edit Settings</span>
            </DropdownMenuItem>
            {isSelectedNotSchemaLocked &&
              !isMaterializedView &&
              !isFunction && (
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
