import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';

interface InfoTooltipProps {
  children: ReactNode;
}

export default function InfoTooltip({ children }: InfoTooltipProps) {
  // The help text often has a docs link, so it stays open while hovered and
  // its links can be clicked.
  return (
    <Tooltip disableHoverableContent={false}>
      <TooltipTrigger asChild>
        <Info className="size-4 text-primary" />
      </TooltipTrigger>
      <TooltipContent className="pointer-events-auto">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
