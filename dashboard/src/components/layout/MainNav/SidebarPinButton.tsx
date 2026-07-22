import { Pin, PinOff } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { cn } from '@/lib/utils';

interface SidebarPinButtonProps {
  pinned: boolean;
  onClick: VoidFunction;
  className?: string;
}

export default function SidebarPinButton({
  pinned,
  onClick,
  className,
}: SidebarPinButtonProps) {
  const label = pinned ? 'Unpin sidebar' : 'Pin sidebar';
  const Icon = pinned ? PinOff : Pin;

  return (
    <div
      className={cn(
        'flex h-10 shrink-0 items-center justify-end border-t px-2',
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={label}
            aria-pressed={pinned}
            className="h-8 w-8 p-0 text-muted-foreground"
            onClick={onClick}
            size="icon"
            variant="ghost"
          >
            <Icon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
