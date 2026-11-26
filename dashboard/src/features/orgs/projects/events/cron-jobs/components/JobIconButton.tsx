import type { ReactNode } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { cn } from '@/lib/utils';

interface JobIconButtonProps {
  label: string;
  onClick: VoidFunction;
  disabled?: boolean;
  destructive?: boolean;
  children: ReactNode;
}

export default function JobIconButton({
  label,
  onClick,
  disabled,
  destructive,
  children,
}: JobIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="subtle"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            destructive && 'hover:text-destructive dark:hover:text-destructive',
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
