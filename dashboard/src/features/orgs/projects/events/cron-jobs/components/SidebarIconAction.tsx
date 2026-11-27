import type { ReactNode } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';

interface SidebarIconActionProps {
  label: string;
  disabled?: boolean;
  selected?: boolean;
  onClick: VoidFunction;
  children: ReactNode;
}

export default function SidebarIconAction({
  label,
  disabled,
  selected,
  onClick,
  children,
}: SidebarIconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Button
            variant="subtle"
            size="icon-xs"
            aria-label={label}
            aria-current={selected ? 'page' : undefined}
            className={selected ? 'text-primary' : undefined}
            disabled={disabled}
            onClick={onClick}
          >
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
