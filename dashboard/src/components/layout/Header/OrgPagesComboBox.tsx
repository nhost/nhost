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

import { useRouter } from 'next/router';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';

import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type Option = {
  value: string;
  label: string;
};

const orgPages = [
  { label: 'Settings', value: 'settings' },
  { label: 'Projects', value: 'projects' },
  { label: 'Members', value: 'members' },
  { label: 'Billing', value: 'billing' },
];

export default function OrgPagesComboBox() {
  const {
    query: { orgSlug },
    push,
    asPath,
  } = useRouter();

  const isPlatform = useIsPlatform();

  const pathSegments = useMemo(() => asPath.split('/'), [asPath]);
  const orgPageFromUrl = pathSegments[3] || null;

  const selectedOrgPageFromUrl = orgPages.find(
    (item) => item.value === orgPageFromUrl,
  );

  const [selectedOrgPage, setSelectedOrgPage] = useState<Option | null>(null);

  useEffect(() => {
    if (selectedOrgPageFromUrl) {
      setSelectedOrgPage(selectedOrgPageFromUrl);
    }
  }, [selectedOrgPageFromUrl]);

  const options: Option[] = orgPages.map((page) => ({
    label: page.label,
    value: page.value,
  }));

  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger disabled={!isPlatform} asChild>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 bg-background text-foreground hover:bg-accent dark:hover:bg-muted"
        >
          {selectedOrgPage ? (
            <div>{selectedOrgPage.label}</div>
          ) : (
            <>Select a page</>
          )}
          <ChevronsUpDown className="h-5 w-5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" side="bottom" align="start">
        <Command>
          <CommandInput placeholder="Select a page..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    setSelectedOrgPage(option);
                    setOpen(false);
                    push(`/orgs/${orgSlug}/${option.value}`);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedOrgPage?.value === option.value
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                  <div className="flex flex-row items-center gap-2">
                    <span className="max-w-52 truncate">{option.label}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
