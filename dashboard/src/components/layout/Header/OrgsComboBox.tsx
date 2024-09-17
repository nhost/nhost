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

import { Badge } from '@/components/ui/v3/badge';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState, type ReactElement } from 'react';

type Option = {
  value: string;
  label: string;
  badge: ReactElement;
};

const options: Option[] = [
  {
    name: "Hassan's org",
    slug: 'x2f9k7m1p3q8r',
    isFree: false,
    plan: 'Pro',
    projects: [
      { name: 'eu-central-1.celsia' },
      { name: 'joyent' },
      { name: 'react-apollo' },
    ],
  },
  {
    name: 'nhost-testing',
    slug: 'a3b7c9d1e5f2g',
    isFree: true,
    plan: 'Starter',
  },
  {
    name: 'uflip',
    slug: 'h4j2l6n8m0p5q',
    isFree: false,
    plan: 'Team',
  },
].map((org) => ({
  label: org.name,
  value: org.slug,
  badge: (
    <Badge
      variant={org.isFree ? 'outline' : 'default'}
      className={cn(
        org.isFree ? 'bg-muted' : '',
        'hover:none ml-2 h-5 px-[6px] text-[10px]',
      )}
    >
      {org.plan}
    </Badge>
  ),
}));

export default function OrgsComboBox() {
  const [open, setOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Option | null>(options[0]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 text-foreground"
        >
          {selectedOrg ? (
            <div className="flex flex-row items-center justify-center">
              {selectedOrg.label}
              {selectedOrg.badge}
            </div>
          ) : (
            <>Select organization</>
          )}
          <ChevronsUpDown className="h-5 w-5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" side="bottom" align="start">
        <Command>
          <CommandInput placeholder="Change status..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={(value) => {
                    setSelectedOrg(
                      options.find((o) => o.label === value) || null,
                    );

                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedOrg?.value === option.value
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                  <span>{option.label}</span>
                  {option.badge}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
