import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import type { BaseEventTriggerFormTriggerProps } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm';
import { DeleteEventTriggerDialog } from '@/features/orgs/projects/events/event-triggers/components/DeleteEventTriggerDialog';
import { EditEventTriggerForm } from '@/features/orgs/projects/events/event-triggers/components/EditEventTriggerForm';
import type { EventTriggerViewModel } from '@/features/orgs/projects/events/event-triggers/types';
import { cn } from '@/lib/utils';
import { Ellipsis, SquarePen, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useRef, useState } from 'react';

const menuItemClassName =
  'flex h-9 cursor-pointer items-center gap-2 rounded-none border border-b-1 !text-sm+ font-medium leading-4';

export interface EventTriggerListItemProps {
  eventTrigger: EventTriggerViewModel;
  isViewOnly: boolean;
}

export default function EventTriggerListItem({
  eventTrigger,
  isViewOnly,
}: EventTriggerListItemProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain, eventTriggerSlug } = router.query;
  const editTriggerRef = useRef<BaseEventTriggerFormTriggerProps | null>(null);
  const isSelected = eventTrigger.name === eventTriggerSlug;
  const href = `/orgs/${orgSlug}/projects/${appSubdomain}/events/event-triggers/${eventTrigger.name}`;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [showDeleteEventTriggerDialog, setShowDeleteEventTriggerDialog] =
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
                text={eventTrigger.name}
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
                  Edit Event Trigger
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setShowDeleteEventTriggerDialog(true)}
                  className={cn(
                    menuItemClassName,
                    'text-destructive focus:text-destructive',
                  )}
                >
                  <Trash2 className="size-4" />
                  Delete Event Trigger
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Button>
      </div>
      <EditEventTriggerForm
        eventTrigger={eventTrigger}
        trigger={(controls) => {
          editTriggerRef.current = controls;
          return null;
        }}
      />
      <DeleteEventTriggerDialog
        open={showDeleteEventTriggerDialog}
        setOpen={setShowDeleteEventTriggerDialog}
        eventTriggerToDelete={eventTrigger.name}
      />
    </>
  );
}
