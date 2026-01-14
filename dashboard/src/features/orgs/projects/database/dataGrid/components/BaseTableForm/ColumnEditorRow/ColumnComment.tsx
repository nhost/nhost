import { Button } from '@/components/ui/v3/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { Textarea } from '@/components/ui/v3/textarea';
import { isEmptyValue } from '@/lib/utils';
import { MessageSquare, MessageSquareText } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

interface ColumnCommentProps {
  index: number;
}

function ColumnComment({ index }: ColumnCommentProps) {
  const { register } = useFormContext();
  const comment = useWatch({ name: `columns.${index}.comment` });

  const CommentIcon = isEmptyValue(comment) ? MessageSquare : MessageSquareText;
  const title = isEmptyValue(comment) ? 'Add comment' : 'Edit comment';

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
          title={title}
          data-testid={`columns.${index}.comment`}
          className="h-8 w-8 hover:bg-[#eaedf0] dark:hover:bg-[#2f363d]"
        >
          <CommentIcon strokeWidth={1} className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 data-[state=closed]:duration-100 data-[state=open]:duration-100"
        align="end"
      >
        <Textarea
          {...register(`columns.${index}.comment`, { shouldUnregister: false })}
          onKeyDown={handleKeyDown}
          className="resize-none"
          placeholder="Add a comment for the column"
        />
      </PopoverContent>
    </Popover>
  );
}

export default ColumnComment;
