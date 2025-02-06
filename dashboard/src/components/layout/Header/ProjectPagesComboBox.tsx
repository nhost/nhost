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
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState, type ReactElement } from 'react';

type Option = {
  value: string;
  label: string;
  icon: ReactElement;
  disabled: boolean;
};

type SelectedOption = Omit<Option, 'disabled'>;

export default function ProjectPagesComboBox() {
  const {
    query: { orgSlug, appSubdomain },
    push,
    asPath,
  } = useRouter();

  const isPlatform = useIsPlatform();

  const projectPages = useMemo(
    () => [
      {
        label: 'Overview',
        value: 'overview',
        icon: <HomeIcon className="h-4 w-4" />,
        slug: '',
        disabled: false,
      },
      {
        label: 'Database',
        value: 'database',
        icon: <DatabaseIcon className="h-4 w-4" />,
        slug: '/database/browser/default',
        disabled: false,
      },
      {
        label: 'GraphQL',
        value: 'graphql',
        icon: <GraphQLIcon className="h-4 w-4" />,
        slug: 'graphql',
        disabled: false,
      },
      {
        label: 'Hasura',
        value: 'hasura',
        icon: <HasuraIcon className="h-4 w-4" />,
        slug: 'hasura',
        disabled: false,
      },
      {
        label: 'Auth',
        value: 'users',
        icon: <UserIcon className="h-4 w-4" />,
        slug: 'users',
        disabled: false,
      },
      {
        label: 'Storage',
        value: 'storage',
        icon: <StorageIcon className="h-4 w-4" />,
        slug: 'storage',
        disabled: false,
      },
      {
        label: 'Run',
        value: 'run',
        icon: <ServicesIcon className="h-4 w-4" />,
        slug: 'run',
        disabled: false,
      },
      {
        label: 'AI',
        value: 'ai',
        icon: <AIIcon className="h-4 w-4" />,
        slug: 'ai/auto-embeddings',
        disabled: false,
      },
      {
        label: 'Deployments',
        value: 'deployments',
        icon: <RocketIcon className="h-4 w-4" />,
        slug: 'deployments',
        disabled: !isPlatform,
      },
      {
        label: 'Backups',
        value: 'backups',
        icon: <CloudIcon className="h-4 w-4" />,
        slug: 'backups',
        disabled: !isPlatform,
      },
      {
        label: 'Logs',
        value: 'logs',
        icon: <FileTextIcon className="h-4 w-4" />,
        slug: 'logs',
        disabled: !isPlatform,
      },
      {
        label: 'Metrics',
        value: 'metrics',
        icon: <GaugeIcon className="h-4 w-4" />,
        slug: 'metrics',
        disabled: !isPlatform,
      },
      {
        label: 'Settings',
        value: 'settings',
        icon: <CogIcon className="h-4 w-4" />,
        slug: 'settings',
        disabled: false,
      },
    ],
    [isPlatform],
  );

  const pathSegments = useMemo(() => asPath.split('/'), [asPath]);
  const projectPageFromUrl = appSubdomain
    ? pathSegments[5] || 'overview'
    : null;
  const selectedProjectPageFromUrl = projectPages.find(
    (item) => item.value === projectPageFromUrl,
  );
  const [selectedProjectPage, setSelectedProjectPage] =
    useState<SelectedOption | null>(null);

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
    disabled: app.disabled,
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
                  disabled={option.disabled}
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
