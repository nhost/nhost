import { Ellipsis, Settings, SquarePen, Trash2 } from 'lucide-react';
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
  onEditFunction: () => void;
  /** Not yet implemented - dropdown item commented out */
  onEditPermissions?: () => void;
  /** Not yet implemented - dropdown item commented out */
  onViewPermissions?: () => void;
  onEditSettings: () => void;
  onViewSettings: () => void;
  onDelete: () => void;
};

function FunctionActions({
  tableName,
  open,
  className,
  onClose,
  onOpen,
  disabled,
  isSelectedNotSchemaLocked,
  onEditFunction,
  onEditPermissions: _onEditPermissions,
  onViewPermissions: _onViewPermissions,
  onEditSettings,
  onViewSettings,
  onDelete,
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
          id={`function-management-menu-${tableName}`}
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
            {/* View Permissions for functions - not yet implemented
            <DropdownMenuItem
              className={menuItemClassName}
              onClick={onViewPermissions}
            >
              <Users className="h-4 w-4" /> <span>View Permissions</span>
            </DropdownMenuItem>
            */}
            <DropdownMenuItem
              className={menuItemClassName}
              onClick={onViewSettings}
            >
              <Settings className="h-4 w-4" /> <span>View Settings</span>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            {isSelectedNotSchemaLocked && (
              <DropdownMenuItem
                className={menuItemClassName}
                onClick={onEditFunction}
              >
                <SquarePen className="h-4 w-4" /> <span>Edit Function</span>
              </DropdownMenuItem>
            )}
            {/* Edit Permissions for functions - not yet implemented
            <DropdownMenuItem
              className={menuItemClassName}
              onClick={onEditPermissions}
            >
              <Users className="h-4 w-4" /> <span>Edit Permissions</span>
            </DropdownMenuItem>
            */}
            <DropdownMenuItem
              className={menuItemClassName}
              onClick={onEditSettings}
            >
              <Settings className="h-4 w-4" /> <span>Edit Settings</span>
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
                <span>Delete Function</span>
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default FunctionActions;
