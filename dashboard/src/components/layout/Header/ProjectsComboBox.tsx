import { Button } from '@/components/ui/v3/button';
import { cn } from '@/lib/utils';

import {
  Command,
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

import { Box, Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';

type Option = {
  value: string;
  label: string;
};

const projects = [
  { name: 'eu-central-1.celsia', slug: 'x2f9k7m1p3q8r' },
  { name: 'joyent', slug: 'a3b7c9d1e5f2g' },
  { name: 'react-apollo', slug: 'h4j2l6n8m0p5q' },
];

const options: Option[] = projects.map((project) => ({
  label: project.name,
  value: project.slug,
}));

export default function ProjectsComboBox() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Option | null>(options[0]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 text-foreground"
        >
          {selected ? (
            <div className="flex flex-row items-center justify-center gap-2">
              <Box className="h-4 w-4" />
              {selected.label}
            </div>
          ) : (
            <>Select project</>
          )}
          <ChevronsUpDown className="h-5 w-5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" side="bottom" align="start">
        <Command>
          <CommandInput placeholder="Change status..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup className="bg-background">
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={(value) => {
                    setSelected(options.find((o) => o.label === value) || null);

                    setOpen(false);
                  }}
                  className="flex flex-row gap-2"
                >
                  <Check
                    className={cn(
                      'h-4 w-4',
                      selected?.value === option.value
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                  <Box className="h-4 w-4" />
                  <span>{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
