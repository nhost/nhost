import { Sparkles } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { BaseActionFormValues } from '@/features/orgs/projects/actions/components/BaseActionForm/BaseActionFormTypes';
import { buildActionSdlPrompt } from '@/features/orgs/projects/actions/utils/buildActionSdlPrompt';
import { cn } from '@/lib/utils';
import { copy } from '@/utils/copy';

export interface CopyToLlmButtonProps {
  target: 'definition' | 'types';
  className?: string;
}

export default function CopyToLlmButton({
  target,
  className,
}: CopyToLlmButtonProps) {
  const { getValues } = useFormContext<BaseActionFormValues>();

  const handleCopy = () => {
    const { actionDefinitionSdl, typesSdl } = getValues();
    copy(
      buildActionSdlPrompt({ target, actionDefinitionSdl, typesSdl }),
      'Prompt',
    );
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          aria-label="Copy a prompt to write this field with an LLM"
          className={cn(
            'h-7 gap-1.5 bg-background px-2 text-muted-foreground text-xs',
            className,
          )}
        >
          <Sparkles className="size-3.5" />
          Copy to LLM
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Copy a prompt to draft this field with an AI tool, then paste the result
        back.
      </TooltipContent>
    </Tooltip>
  );
}
