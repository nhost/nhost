import { Ellipsis, SquarePen, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import type { BaseCronTriggerFormTriggerProps } from '@/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm';
import { DeleteCronTriggerDialog } from '@/features/orgs/projects/events/cron-triggers/components/DeleteCronTriggerDialog';
import { EditCronTriggerForm } from '@/features/orgs/projects/events/cron-triggers/components/EditCronTriggerForm';
import { cn } from '@/lib/utils';
import type { CronTrigger } from '@/utils/hasura-api/generated/schemas';

const menuItemClassName =
  'flex h-9 cursor-pointer items-center gap-2 rounded-none border border-b-1 !text-sm+ font-medium leading-4';

export interface CronTriggerListItemProps {
  cronTrigger: CronTrigger;
  isViewOnly: boolean;
}

export default function CronTriggerListItem({
  cronTrigger,
  isViewOnly,
}: CronTriggerListItemProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain, cronTriggerSlug } = router.query;
  const editTriggerRef = useRef<BaseCronTriggerFormTriggerProps | null>(null);
  const isSelected = cronTrigger.name === cronTriggerSlug;
  const href = `/orgs/${orgSlug}/projects/${appSubdomain}/events/cron-triggers/${cronTrigger.name}`;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [showDeleteCronTriggerDialog, setShowDeleteCronTriggerDialog] =
    useState(false);

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
                text={cronTrigger.name}
              />
            </Link>

            <DropdownMenu
              modal={false}
              open={isMenuOpen}
              onOpenChange={setIsMenuOpen}
            >
              <DropdownMenuTrigger
                asChild
                disabled={isViewOnly}
                className={cn('relative z-10 opacity-0 transition-opacity', {
                  'group-hover:opacity-100': !isViewOnly,
                  'opacity-100': isSelected || isMenuOpen,
                })}
              >
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    'h-6 w-6 border-none bg-transparent px-0 hover:bg-transparent focus-visible:bg-transparent',
                    {
                      '!pointer-events-auto !cursor-not-allowed': isViewOnly,
                    },
                  )}
                  data-testid={`cron-trigger-menu-${cronTrigger.name}`}
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
                  Edit Cron Trigger
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setShowDeleteCronTriggerDialog(true)}
                  className={cn(
                    menuItemClassName,
                    'text-destructive focus:text-destructive',
                  )}
                >
                  <Trash2 className="size-4" />
                  Delete Cron Trigger
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Button>
      </div>
      <EditCronTriggerForm
        cronTrigger={cronTrigger}
        trigger={(controls) => {
          editTriggerRef.current = controls;
          return null;
        }}
      />
      <DeleteCronTriggerDialog
        open={showDeleteCronTriggerDialog}
        setOpen={setShowDeleteCronTriggerDialog}
        cronTriggerToDelete={cronTrigger.name}
      />
    </>
  );
}
