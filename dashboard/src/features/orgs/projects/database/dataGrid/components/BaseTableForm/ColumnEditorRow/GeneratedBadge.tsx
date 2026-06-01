import { Sigma } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';

export interface GeneratedBadgeProps {
  generationExpression: string | null | undefined;
}

export function GeneratedBadge({ generationExpression }: GeneratedBadgeProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="mr-1 flex cursor-help items-center text-muted-foreground">
          <Sigma width={14} height={14} aria-label="Generated column" />
        </span>
      </TooltipTrigger>
      <TooltipContent sideOffset={8}>
        <span className="font-semibold">Generated column</span> — value is
        computed from {generationExpression}. Type and constraints are fixed,
        but you can rename, edit the comment, or drop the column.
      </TooltipContent>
    </Tooltip>
  );
}

export default GeneratedBadge;
