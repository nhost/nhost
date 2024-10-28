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
  Check,
  ChevronsUpDown,
  CloudIcon,
  CogIcon,
  DatabaseIcon,
  FileTextIcon,
  GaugeIcon,
  HomeIcon,
  RocketIcon,
  UserIcon,
} from 'lucide-react';

import { AIIcon } from '@/components/ui/v2/icons/AIIcon';
import { GraphQLIcon } from '@/components/ui/v2/icons/GraphQLIcon';
import { HasuraIcon } from '@/components/ui/v2/icons/HasuraIcon';
import { ServicesIcon } from '@/components/ui/v2/icons/ServicesIcon';
import { StorageIcon } from '@/components/ui/v2/icons/StorageIcon';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState, type ReactElement } from 'react';

type Option = {
  value: string;
  label: string;
  icon: ReactElement;
};

const projectPages = [
  {
    label: 'Overview',
    value: 'overview',
    icon: <HomeIcon className="w-4 h-4" />,
    slug: '',
  },
  {
    label: 'Database',
    value: 'database',
    icon: <DatabaseIcon className="w-4 h-4" />,
    slug: '/database/browser/default',
  },
  {
    label: 'GraphQL',
    value: 'graphql',
    icon: <GraphQLIcon className="w-4 h-4" />,
    slug: 'graphql',
  },
  {
    label: 'Hasura',
    value: 'hasura',
    icon: <HasuraIcon className="w-4 h-4" />,
    slug: 'hasura',
  },
  {
    label: 'Auth',
    value: 'users',
    icon: <UserIcon className="w-4 h-4" />,
    slug: 'users',
  },
  {
    label: 'Storage',
    value: 'storage',
    icon: <StorageIcon className="w-4 h-4" />,
    slug: 'storage',
  },
  {
    label: 'Run',
    value: 'run',
    icon: <ServicesIcon className="w-4 h-4" />,
    slug: 'run',
  },
  {
    label: 'AI',
    value: 'ai',
    icon: <AIIcon className="w-4 h-4" />,
    slug: 'ai/auto-embeddings',
  },
  {
    label: 'Deployments',
    value: 'deployments',
    icon: <RocketIcon className="w-4 h-4" />,
    slug: 'deployments',
  },
  {
    label: 'Backups',
    value: 'backups',
    icon: <CloudIcon className="w-4 h-4" />,
    slug: 'backups',
  },
  {
    label: 'Logs',
    value: 'logs',
    icon: <FileTextIcon className="w-4 h-4" />,
    slug: 'logs',
  },
  {
    label: 'Metrics',
    value: 'metrics',
    icon: <GaugeIcon className="w-4 h-4" />,
    slug: 'metrics',
  },
  {
    label: 'Settings',
    value: 'settings',
    icon: <CogIcon className="w-4 h-4" />,
    slug: 'settings',
  },
];

export default function ProjectPagesComboBox() {
  const {
    query: { orgSlug, appSubdomain },
    push,
    asPath,
  } = useRouter();

  const pathSegments = useMemo(() => asPath.split('/'), [asPath]);
  const projectPageFromUrl = appSubdomain
    ? pathSegments[5] || 'overview'
    : null;
  const selectedProjectPageFromUrl = projectPages.find(
    (item) => item.value === projectPageFromUrl,
  );
  const [selectedProjectPage, setSelectedProjectPage] = useState<Option | null>(
    null,
  );

  useEffect(() => {
    if (selectedProjectPageFromUrl) {
      setSelectedProjectPage({
        label: selectedProjectPageFromUrl.label,
        value: selectedProjectPageFromUrl.slug,
        icon: selectedProjectPageFromUrl.icon,
      });
    }
  }, [selectedProjectPageFromUrl]);

  const options: Option[] = projectPages.map((app) => ({
    label: app.label,
    value: app.slug,
    icon: app.icon,
  }));

  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 bg-background text-foreground hover:bg-accent dark:hover:bg-muted"
        >
          {selectedProjectPage ? (
            <div className="flex flex-row items-center justify-center gap-2">
              {selectedProjectPage.icon}
              {selectedProjectPage.label}
            </div>
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
                    setSelectedProjectPage(option);
                    setOpen(false);
                    push(
                      `/orgs/${orgSlug}/projects/${appSubdomain}/${option.value}`,
                    );
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedProjectPage?.value === option.value
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                  <div className="flex flex-row items-center gap-2">
                    {option.icon}
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
