import { Ellipsis } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
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
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import { cn } from '@/lib/utils';

const menuItemClassName =
  'flex h-9 cursor-pointer items-center gap-2 rounded-none border border-b-1 !text-sm+ font-medium leading-4';

export interface SidebarListItemAction {
  icon: ReactNode;
  label: string;
  onSelect: () => void;
  destructive?: boolean;
}

interface NativeQueriesSidebarListItemProps {
  name: string;
  href: string;
  isSelected: boolean;
  icon: ReactNode;
  iconTooltip: string;
  actions: SidebarListItemAction[];
}

export default function NativeQueriesSidebarListItem({
  name,
  href,
  isSelected,
  icon,
  iconTooltip,
  actions,
}: NativeQueriesSidebarListItemProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="group pb-1">
      <Button
        asChild
        variant="link"
        size="sm"
        className={cn(
          'flex w-full max-w-full justify-between pl-0 text-sm+ hover:bg-accent hover:no-underline',
          isSelected && 'bg-table-selected',
        )}
      >
        <div className="flex w-full max-w-full items-center">
          <Link
            href={href}
            className={cn(
              'flex h-full w-[calc(100%-1.6rem)] items-center gap-1.5 p-[0.625rem] pr-0 text-left',
              isSelected && 'text-primary-main',
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>{icon}</TooltipTrigger>
              <TooltipContent side="left" sideOffset={8}>
                {iconTooltip}
              </TooltipContent>
            </Tooltip>
            <TextWithTooltip
              containerClassName="w-full"
              className={cn(
                '!truncate text-sm+',
                isSelected && 'text-primary-main',
              )}
              text={name}
            />
          </Link>

          <DropdownMenu
            modal={false}
            open={isMenuOpen}
            onOpenChange={setIsMenuOpen}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  'relative z-10 h-6 w-6 border-none bg-transparent px-0 opacity-0 transition-opacity hover:bg-transparent focus-visible:bg-transparent group-hover:opacity-100',
                  (isSelected || isMenuOpen) && 'opacity-100',
                )}
                aria-label={`Actions for ${name}`}
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
              className="w-52 p-0 text-foreground"
              forceMount
            >
              {actions.map((action) => (
                <DropdownMenuItem
                  key={action.label}
                  onSelect={action.onSelect}
                  className={cn(
                    menuItemClassName,
                    action.destructive &&
                      'text-destructive focus:text-destructive',
                  )}
                >
                  {action.icon}
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Button>
    </div>
  );
}
