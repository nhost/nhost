import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import {
  Command,
  CommandCreateItem,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/v3/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import type { ExecuteFormValues } from '@/features/orgs/projects/serverless-functions/types';
import { cn } from '@/lib/utils';

const CONTENT_TYPE_GROUPS = [
  {
    heading: 'JSON / XML',
    options: [
      'application/json',
      'application/ld+json',
      'application/hal+json',
      'application/vnd.api+json',
      'application/xml',
      'text/xml',
    ],
  },
  {
    heading: 'Form',
    options: ['application/x-www-form-urlencoded', 'multipart/form-data'],
  },
  {
    heading: 'Text',
    options: ['text/html', 'text/plain'],
  },
];

export default function ContentTypeCombobox() {
  const { setValue, watch } = useFormContext<ExecuteFormValues>();
  const value = watch('contentType');
  const [open, setOpen] = useState(false);

  const handleSelect = (contentType: string) => {
    setValue('contentType', contentType);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-8 w-80 justify-between font-normal text-sm"
        >
          <span className="truncate">{value || 'None'}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command>
          <CommandInput placeholder="Search or enter custom..." />
          <CommandList>
            <CommandEmpty>No content type found.</CommandEmpty>
            <CommandItem value="none" onSelect={() => handleSelect('')}>
              None
              <Check
                className={cn(
                  'ml-auto h-4 w-4',
                  !value ? 'opacity-100' : 'opacity-0',
                )}
              />
            </CommandItem>
            {CONTENT_TYPE_GROUPS.map((group) => (
              <CommandGroup key={group.heading} heading={group.heading}>
                {group.options.map((contentType) => (
                  <CommandItem
                    key={contentType}
                    value={contentType}
                    onSelect={() => handleSelect(contentType)}
                  >
                    {contentType}
                    <Check
                      className={cn(
                        'ml-auto h-4 w-4',
                        value === contentType ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            <CommandCreateItem onCreate={handleSelect} />
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
