import { MessageSquare, MessageSquareText } from 'lucide-react';
import type { ComponentProps, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { Textarea } from '@/components/ui/v3/textarea';
import type { TypedFieldNoun } from '@/features/orgs/projects/database/native-queries/components/TypedFieldRow';
import { cn } from '@/lib/utils';

interface TypedFieldDescriptionProps {
  noun: TypedFieldNoun;
  index: number;
  value?: string;
  inputProps: ComponentProps<'textarea'>;
}

export default function TypedFieldDescription({
  noun,
  index,
  value,
  inputProps,
}: TypedFieldDescriptionProps) {
  const position = index + 1;
  const lowercaseNoun = noun.toLowerCase();
  const hasDescription = value !== undefined && value !== '';
  const actionLabel = hasDescription ? 'Edit description' : 'Add description';
  const textareaLabel = `${noun} ${position} description`;
  const DescriptionIcon = hasDescription ? MessageSquareText : MessageSquare;

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title={actionLabel}
          data-testid={`${lowercaseNoun}s.${index}.description`}
          className="h-8 w-8 hover:bg-[#eaedf0] dark:hover:bg-[#2f363d]"
        >
          <DescriptionIcon strokeWidth={1} className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 data-[state=closed]:duration-100 data-[state=open]:duration-100"
        align="end"
        onEscapeKeyDown={(event) => event.stopPropagation()}
      >
        <Textarea
          {...inputProps}
          aria-label={textareaLabel}
          className={cn('resize-none', inputProps.className)}
          placeholder={
            inputProps.placeholder ??
            `Add a description for this ${lowercaseNoun}`
          }
          onKeyDown={(event) => {
            inputProps.onKeyDown?.(event);
            handleKeyDown(event);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
