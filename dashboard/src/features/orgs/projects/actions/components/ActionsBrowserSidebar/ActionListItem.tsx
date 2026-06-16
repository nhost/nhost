import { Ellipsis, SquarePen, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useRef, useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { InlineCode } from '@/components/presentational/InlineCode';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import type { BaseActionFormTriggerProps } from '@/features/orgs/projects/actions/components/BaseActionForm';
import { DeleteActionDialog } from '@/features/orgs/projects/actions/components/DeleteActionDialog';
import { EditActionForm } from '@/features/orgs/projects/actions/components/EditActionForm';
import { EditActionPermissionsForm } from '@/features/orgs/projects/actions/components/EditActionPermissionsForm';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import { cn } from '@/lib/utils';
import type { ActionItem } from '@/utils/hasura-api/generated/schemas';

const menuItemClassName =
  'flex h-9 cursor-pointer items-center gap-2 rounded-none border border-b-1 !text-sm+ font-medium leading-4';

export interface ActionListItemProps {
  action: ActionItem;
}

export default function ActionListItem({ action }: ActionListItemProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain, actionSlug } = router.query;
  const editTriggerRef = useRef<BaseActionFormTriggerProps | null>(null);
  const isSelected = action.name === actionSlug;
  const href = `/orgs/${orgSlug}/projects/${appSubdomain}/graphql/actions/${action.name}`;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [showDeleteActionDialog, setShowDeleteActionDialog] = useState(false);

  const { openDrawer, closeDrawer } = useDialog();

  function handleEditPermissionsClick() {
    openDrawer({
      title: (
        <span className="inline-grid grid-flow-col items-center gap-2">
          Permissions for
          <InlineCode className="!text-sm+ font-normal">
            {action.name}
          </InlineCode>
          Action
        </span>
      ),
      component: (
        <EditActionPermissionsForm
          actionName={action.name}
          onCancel={closeDrawer}
        />
      ),
      props: {
        PaperProps: {
          className: 'lg:w-[65%] lg:max-w-7xl',
        },
      },
    });
  }

  return (
    <>
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
                'flex h-full w-[calc(100%-1.6rem)] items-center p-[0.625rem] pr-0 text-left',
                {
                  'text-primary-main': isSelected,
                },
              )}
            >
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
                  onSelect={() => {
                    editTriggerRef.current?.open?.();
                  }}
                  className={menuItemClassName}
                >
                  <SquarePen className="size-4" />
                  Edit Action
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={handleEditPermissionsClick}
                  className={menuItemClassName}
                >
                  <Users className="size-4" />
                  Edit Permissions
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setShowDeleteActionDialog(true)}
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
      <EditActionForm
        action={action}
        trigger={(controls) => {
          editTriggerRef.current = controls;
          return null;
        }}
      />
      <DeleteActionDialog
        open={showDeleteActionDialog}
        setOpen={setShowDeleteActionDialog}
        actionToDelete={action.name}
      />
    </>
  );
}
