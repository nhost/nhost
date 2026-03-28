import { Check, ChevronsUpDown } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
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

const projectGraphQLPages = [
  {
    name: 'Playground',
    slug: 'playground',
    route: '',
  },
  {
    name: 'Remote Schemas',
    slug: 'remote-schemas',
    route: 'remote-schemas',
  },
  {
    name: 'Metadata',
    slug: 'metadata',
    route: 'metadata',
  },
].map((item) => ({
  label: item.name,
  value: item.slug,
  route: item.route,
}));

export default function ProjectGraphQLPagesComboBox() {
  const {
    query: { orgSlug, appSubdomain },
    push,
    asPath,
  } = useRouter();

  const pathSegments = useMemo(() => asPath.split('/'), [asPath]);
  const isGraphQLPage = pathSegments.includes('graphql');
  const graphQLPageFromUrl = isGraphQLPage
    ? pathSegments[6] || 'playground'
    : null;

  const selectedGraphQLPageFromUrl = projectGraphQLPages.find(
    (item) => item.value === graphQLPageFromUrl,
  );
  const [selectedGraphQLPage, setSelectedGraphQLPage] = useState<Option | null>(
    null,
  );

  useEffect(() => {
    if (selectedGraphQLPageFromUrl) {
      setSelectedGraphQLPage({
        label: selectedGraphQLPageFromUrl.label,
        value: selectedGraphQLPageFromUrl.value,
        route: selectedGraphQLPageFromUrl.route,
      });
    }
  }, [selectedGraphQLPageFromUrl]);

  const options: Option[] = projectGraphQLPages.map((page) => ({
    label: page.label,
    value: page.value,
    route: page.route,
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
          {selectedGraphQLPage ? (
            <div>{selectedGraphQLPage.label}</div>
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
                    setSelectedGraphQLPage(option);
                    setOpen(false);
                    push(
                      `/orgs/${orgSlug}/projects/${appSubdomain}/graphql/${option.route}/`,
                    );
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedGraphQLPage?.value === option.value
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
