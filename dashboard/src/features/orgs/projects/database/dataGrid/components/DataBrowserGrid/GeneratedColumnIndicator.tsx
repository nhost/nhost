import { Sigma } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';

interface GeneratedColumnIndicatorProps {
  generationExpression: string;
}

export default function GeneratedColumnIndicator({
  generationExpression,
}: GeneratedColumnIndicatorProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Sigma width={14} height={14} aria-label="Generated Column" />
      </TooltipTrigger>
      <TooltipContent sideOffset={8}>
        <span className="font-semibold">Generated column</span> — automatically
        generated from {generationExpression}. Cannot be edited.
      </TooltipContent>
    </Tooltip>
  );
}
