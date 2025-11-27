import { Button } from '@/components/ui/v3/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { Textarea } from '@/components/ui/v3/textarea';
import { ExpandIcon } from 'lucide-react';
import type { ChangeEventHandler, KeyboardEvent } from 'react';

type DataGridFilterValuePopupProps = {
  value: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
};

function DataGridFilterValuePopup({
  value,
  onChange,
}: DataGridFilterValuePopupProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
    }
  }

  return (
    <div className="absolute right-0 top-0 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Expand filter value"
            className="h-8 w-8 hover:bg-[#eaedf0] dark:hover:bg-[#2f363d]"
          >
            <ExpandIcon strokeWidth={1} className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[34rem] p-0 data-[state=closed]:duration-100 data-[state=open]:duration-100"
          align="end"
        >
          <Textarea
            className="h-60"
            value={value}
            onKeyDown={handleKeyDown}
            onChange={onChange}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default DataGridFilterValuePopup;
