import { Ellipsis, FilePen, FileSearch, SquarePen, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { EditActionForm } from '@/features/orgs/projects/graphql/actions/components/EditActionForm';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import { cn } from '@/lib/utils';
import type { ActionItem } from '@/utils/hasura-api/generated/schemas';

const menuItemClassName =
  'flex h-9 cursor-pointer items-center gap-2 rounded-none border border-b-1 !text-sm+ font-medium leading-4';

export interface ActionListItemProps {
  action: ActionItem;
  onDeleteAction: (action: ActionItem) => void;
}

export default function ActionListItem({
  action,
  onDeleteAction,
}: ActionListItemProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain, actionSlug } = router.query;
  const isSelected = action.name === actionSlug;
  const href = `/orgs/${orgSlug}/projects/${appSubdomain}/graphql/actions/${action.name}`;
  const actionType = action.definition.type ?? 'mutation';
  const ActionIcon = actionType === 'query' ? FileSearch : FilePen;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { openDrawer } = useDialog();

  function handleEditClick() {
    openDrawer({
      title: 'Edit Action',
      component: <EditActionForm action={action} />,
    });
  }

  return (
    <div className="group pb-1">
      <Button
        asChild
        variant="link"
        size="sm"
        className={cn(
          'flex w-full max-w-full justify-between pl-0 text-sm+ hover:bg-accent hover:no-underline',
          {
            'bg-table-selected': isSelected,
          },
        )}
      >
        <div className="flex w-full max-w-full items-center">
          <Link
            href={href}
            className={cn(
              'flex h-full w-[calc(100%-1.6rem)] items-center gap-1.5 p-[0.625rem] pr-0 text-left',
              {
                'text-primary-main': isSelected,
              },
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <ActionIcon className="h-4 w-4 shrink-0 text-primary" />
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={8}>
                {actionType === 'query' ? 'Query' : 'Mutation'}
              </TooltipContent>
            </Tooltip>
            <TextWithTooltip
              containerClassName="w-full"
              className={cn('!truncate text-sm+', {
                'text-primary-main': isSelected,
              })}
              text={action.name}
            />
          </Link>

          <DropdownMenu
            modal={false}
            open={isMenuOpen}
            onOpenChange={setIsMenuOpen}
          >
            <DropdownMenuTrigger
              asChild
              className={cn(
                'relative z-10 opacity-0 transition-opacity group-hover:opacity-100',
                {
                  'opacity-100': isSelected || isMenuOpen,
                },
              )}
            >
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6 border-none bg-transparent px-0 hover:bg-transparent focus-visible:bg-transparent"
                aria-label={`Actions for ${action.name}`}
                data-testid={`action-menu-${action.name}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <Ellipsis className="size-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="bottom"
              className="w-52 p-0"
              forceMount
            >
              <DropdownMenuItem
                onSelect={handleEditClick}
                className={menuItemClassName}
              >
                <SquarePen className="size-4" />
                Edit Action
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onDeleteAction(action)}
                className={cn(
                  menuItemClassName,
                  'text-destructive focus:text-destructive',
                )}
              >
                <Trash2 className="size-4" />
                Delete Action
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Button>
    </div>
  );
}
