import { Button } from '@/components/ui/v3/button';
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
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

type Option = {
  value: string;
  label: string;
};

const projectSettingsPages = [
  'General',
  'Compute Resources',
  'Database',
  'Hasura',
  'Authentication',
  'Sign-In methods',
  'Storage',
  'Roles and Permissions',
  'SMTP',
  'Git',
  'Environment Variables',
  'Secrets',
  'Custom Domains',
  'Rate Limiting',
  'AI',
].map((item) => ({
  label: item,
  value: item.toLowerCase().replaceAll(' ', '-'),
}));

export default function ProjectSettingsPagesComboBox() {
  const {
    query: { orgSlug, appSlug },
    push,
    asPath,
  } = useRouter();

  const pathSegments = useMemo(() => asPath.split('/'), [asPath]);
  const isSettingsPage = pathSegments.includes('settings');
  const settingsPageFromUrl = isSettingsPage
    ? pathSegments[6] || 'general'
    : null;

  const selectedSettingsPageFromUrl = projectSettingsPages.find(
    (item) => item.value === settingsPageFromUrl,
  );
  const [selectedSettingsPage, setSelectedSettingsPage] =
    useState<Option | null>(null);

  useEffect(() => {
    if (selectedSettingsPageFromUrl) {
      setSelectedSettingsPage({
        label: selectedSettingsPageFromUrl.label,
        value: selectedSettingsPageFromUrl.value,
      });
    }
  }, [selectedSettingsPageFromUrl]);

  const options: Option[] = projectSettingsPages.map((page) => ({
    label: page.label,
    value: page.value,
  }));

  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 text-foreground"
        >
          {selectedSettingsPage ? (
            <div>{selectedSettingsPage.label}</div>
          ) : (
            <>Select a page</>
          )}
          <ChevronsUpDown className="w-5 h-5 text-muted-foreground" />
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
                    setSelectedSettingsPage(option);
                    setOpen(false);
                    push(
                      `/orgs/${orgSlug}/projects/${appSlug}/settings/${option.value}/`,
                    );
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedSettingsPage?.value === option.value
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                  <div className="flex flex-row items-center gap-2">
                    <span className="truncate max-w-52">{option.label}</span>
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
