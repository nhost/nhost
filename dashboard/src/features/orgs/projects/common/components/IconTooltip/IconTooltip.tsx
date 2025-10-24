import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

interface IconTooltipProps {
  children: ReactNode;
}

export default function IconTooltip({ children }: IconTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="size-4 text-primary" />
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}
