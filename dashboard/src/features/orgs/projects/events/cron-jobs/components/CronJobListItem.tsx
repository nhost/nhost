import { Ellipsis, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { cn } from '@/lib/utils';

interface CronJobListItemProps {
  href: string;
  name: string;
  schedule: string;
  selected: boolean;
  paused?: boolean;
  disabled?: boolean;
  onNavigate: VoidFunction;
  onEdit: VoidFunction;
  onToggle?: VoidFunction;
  onDelete: VoidFunction;
}

export default function CronJobListItem({
  href,
  name,
  schedule,
  selected,
  paused,
  disabled,
  onNavigate,
  onEdit,
  onToggle,
  onDelete,
}: CronJobListItemProps) {
  return (
    <div className="group pb-1">
      <div
        className={cn(
          'flex w-full items-center rounded-md pr-1 hover:bg-accent',
          selected && 'bg-table-selected',
        )}
      >
        <Link
          href={href}
          onClick={onNavigate}
          aria-current={selected ? 'page' : undefined}
          className="flex min-w-0 flex-1 flex-col p-2.5 pr-0 text-left"
        >
          <span
            className={cn(
              'truncate font-medium text-sm+',
              selected && 'text-primary',
              paused && !selected && 'text-muted-foreground',
            )}
          >
            {name}
          </span>
          <span className="flex min-w-0 items-center gap-1 text-muted-foreground text-xs">
            {paused && <Pause className="size-3 shrink-0" />}
            <span className="truncate">{paused ? 'Paused' : schedule}</span>
          </span>
        </Link>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="subtle"
              size="icon-xs"
              aria-label={`${name} actions`}
              className={cn(
                'opacity-100 transition-opacity sm:opacity-0 sm:data-[state=open]:opacity-100 sm:group-hover:opacity-100 sm:focus-visible:opacity-100',
                selected && 'sm:opacity-100',
              )}
            >
              <Ellipsis className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="gap-2 [&_svg]:size-4"
              disabled={disabled}
              onSelect={onEdit}
            >
              <Pencil />
              Edit
            </DropdownMenuItem>
            {onToggle && (
              <DropdownMenuItem
                className="gap-2 [&_svg]:size-4"
                disabled={disabled}
                onSelect={onToggle}
              >
                {paused ? <Play /> : <Pause />}
                {paused ? 'Resume' : 'Pause'}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={disabled}
              className="gap-2 text-destructive focus:bg-destructive-hover focus:text-destructive [&_svg]:size-4"
              onSelect={onDelete}
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
