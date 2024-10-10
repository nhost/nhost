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
  { name: 'General', slug: 'general', route: 'general' },
  {
    name: 'Compute Resources',
    slug: 'resources',
    route: 'compute-resources',
  },
  { name: 'Database', slug: 'database', route: 'database' },
  { name: 'Hasura', slug: 'hasura', route: 'hasura' },
  {
    name: 'Authentication',
    slug: 'authentication',
    route: 'authentication',
  },
  {
    name: 'Sign-In methods',
    slug: 'sign-in-methods',
    route: 'sign-in-methods',
  },
  { name: 'Storage', slug: 'storage', route: 'storage' },
  {
    name: 'Roles and Permissions',
    slug: 'roles-and-permissions',
    route: 'roles-and-permissions',
  },
  { name: 'SMTP', slug: 'smtp', route: 'smtp' },
  { name: 'Git', slug: 'git', route: 'git' },
  {
    name: 'Environment Variables',
    slug: 'environment-variables',
    route: 'environment-variables',
  },
  { name: 'Secrets', slug: 'secrets', route: 'secrets' },
  {
    name: 'Custom Domains',
    slug: 'custom-domains',
    route: 'custom-domains',
  },
  {
    name: 'Rate Limiting',
    slug: 'rate-limiting',
    route: 'rate-limiting',
  },
  { name: 'AI', slug: 'ai', route: 'ai' },
  { name: 'Configuration Editor', slug: 'editor', route: 'editor' },
].map((item) => ({
  label: item.name,
  value: item.slug,
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
