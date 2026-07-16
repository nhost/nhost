import { Pin, PinOff } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';

interface SidebarPinButtonProps {
  pinned: boolean;
  onClick: VoidFunction;
}

export default function SidebarPinButton({
  pinned,
  onClick,
}: SidebarPinButtonProps) {
  const label = pinned ? 'Unpin sidebar' : 'Pin sidebar';
  const Icon = pinned ? PinOff : Pin;

  return (
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
  );
}
