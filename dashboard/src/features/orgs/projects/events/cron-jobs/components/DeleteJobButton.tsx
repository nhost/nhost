import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';

export default function DeleteJobButton({
  onClick,
  disabled,
}: {
  onClick: VoidFunction;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="subtle"
          size="icon"
          aria-label="Delete job"
          disabled={disabled}
          onClick={onClick}
          className="hover:text-destructive dark:hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Delete job</TooltipContent>
    </Tooltip>
  );
}
