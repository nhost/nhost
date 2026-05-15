import { Check, ChevronsUpDown } from 'lucide-react';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
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

type Option = {
  value: string;
  label: string;
  route: string;
};

const projectDatabasePages: Option[] = [
  {
    label: 'Table Editor & Browser',
    value: 'browser',
    route: 'database/browser/default',
  },
  {
    label: 'Schema Navigator',
    value: 'schema',
    route: 'database/schema/default',
  },
];

export default function ProjectDatabasePagesComboBox() {
  const {
    query: { orgSlug, appSubdomain },
    push,
    asPath,
  } = useRouter();

  const pathSegments = useMemo(() => asPath.split('/'), [asPath]);
  const isDatabasePage = pathSegments[5] === 'database';
  const databasePageFromUrl = isDatabasePage
    ? pathSegments[6] || 'browser'
    : null;

  const selectedDatabasePage = useMemo(
    () =>
      projectDatabasePages.find((item) => item.value === databasePageFromUrl) ??
      null,
    [databasePageFromUrl],
  );

  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 bg-background text-foreground hover:bg-accent dark:hover:bg-muted"
        >
          {selectedDatabasePage ? (
            <div>{selectedDatabasePage.label}</div>
          ) : (
            'Select a page'
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
              {projectDatabasePages.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    setOpen(false);
                    push(
                      `/orgs/${orgSlug}/projects/${appSubdomain}/${option.route}`,
                    );
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedDatabasePage?.value === option.value
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
