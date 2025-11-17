import { PencilIcon } from '@/components/ui/v2/icons/PencilIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import type { BaseEventTriggerFormTriggerProps } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm';
import { EditEventTriggerForm } from '@/features/orgs/projects/events/event-triggers/components/EditEventTriggerForm';
import type { EventTriggerViewModel } from '@/features/orgs/projects/events/event-triggers/types';
import { cn } from '@/lib/utils';
import { Ellipsis } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useRef } from 'react';

export interface EventTriggerListItemProps {
  eventTrigger: EventTriggerViewModel;
  onDelete: () => void;
}

export default function EventTriggerListItem({
  eventTrigger,
  onDelete,
}: EventTriggerListItemProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain, eventTriggerSlug } = router.query;
  const editTriggerRef = useRef<BaseEventTriggerFormTriggerProps | null>(null);
  const isSelected = eventTrigger.name === eventTriggerSlug;
  const href = `/orgs/${orgSlug}/projects/${appSubdomain}/events/event-trigger/${eventTrigger.name}`;

  return (
    <>
      <div className="group relative flex">
        <Button
          className={cn(
            'flex h-9 max-w-52 flex-row justify-between gap-2 bg-background px-2 text-foreground hover:bg-accent dark:hover:bg-theme-grey-200',
            {
              'bg-[#ebf3ff] hover:bg-[#ebf3ff] dark:bg-muted dark:hover:bg-muted':
                isSelected,
            },
          )}
          asChild
          variant="ghost"
        >
          <Link href={href} className="flex w-full items-center gap-2">
            <TextWithTooltip
              containerClassName="max-w-36"
              className={cn(isSelected && 'text-primary hover:text-primary')}
              text={eventTrigger.name}
            />
          </Link>
        </Button>
        <DropdownMenu modal={false}>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'invisible absolute right-2 top-1 h-7 w-7 px-0.5 hover:bg-[#eaedf0] group-hover:visible dark:hover:bg-[#2f363d]',
              {
                'visible bg-[#ebf3ff] text-primary hover:bg-[#ebf3ff] hover:text-primary dark:bg-muted dark:hover:bg-muted':
                  isSelected,
              },
            )}
            onClick={(e) => {
              e.preventDefault();
            }}
            asChild
          >
            <DropdownMenuTrigger>
              <Ellipsis className="h-6 w-6" />
            </DropdownMenuTrigger>
          </Button>
          <DropdownMenuContent align="start" forceMount>
            <DropdownMenuItem
              onSelect={() => {
                editTriggerRef.current?.open?.();
              }}
              className="flex cursor-pointer items-center gap-2 !text-sm+ font-medium"
            >
              <PencilIcon className="size-4 text-muted-foreground" />
              Edit Event Trigger
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-0" />
            <DropdownMenuItem
              onSelect={onDelete}
              className="flex cursor-pointer items-center gap-2 !text-sm+ font-medium text-destructive focus:text-destructive"
            >
              <TrashIcon className="size-4" />
              Delete Event Trigger
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <EditEventTriggerForm
        eventTrigger={eventTrigger}
        trigger={(controls) => {
          editTriggerRef.current = controls;
          return null;
        }}
      />
    </>
  );
}
