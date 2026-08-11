import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { cn } from '@/lib/utils';

interface SidebarCollapseButtonProps {
  expanded: boolean;
  onClick: VoidFunction;
  className?: string;
}

export default function SidebarCollapseButton({
  expanded,
  onClick,
  className,
}: SidebarCollapseButtonProps) {
  const label = expanded ? 'Collapse sidebar' : 'Expand sidebar';
  const Icon = expanded ? PanelLeftClose : PanelLeftOpen;

  return (
    <div
      className={cn(
        'flex h-10 shrink-0 items-center border-t px-2',
        expanded ? 'justify-end' : 'justify-center',
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={label}
            aria-expanded={expanded}
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
