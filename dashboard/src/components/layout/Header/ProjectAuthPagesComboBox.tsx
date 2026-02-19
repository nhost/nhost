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
import { MIN_AUTH_VERSION_OAUTH2 } from '@/features/orgs/projects/authentication/oauth2/constants';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useSoftwareVersionsInfo } from '@/features/orgs/projects/common/hooks/useSoftwareVersionsInfo';
import { cn } from '@/lib/utils';
import { isVersionGte } from '@/utils/compareVersions';

type Option = {
  value: string;
  label: string;
  route: string;
};

const allProjectAuthPages = [
  {
    name: 'Users',
    slug: 'users',
    route: 'users',
  },
  {
    name: 'OAuth2 Clients',
    slug: 'oauth2-clients',
    route: 'oauth2-clients',
  },
].map((item) => ({
  label: item.name,
  value: item.slug,
  route: item.route,
}));

export default function ProjectAuthPagesComboBox() {
  const {
    query: { orgSlug, appSubdomain },
    push,
    asPath,
  } = useRouter();
  const isPlatform = useIsPlatform();
  const { auth } = useSoftwareVersionsInfo();

  const isOAuth2Available =
    !isPlatform ||
    isVersionGte(auth.configuredVersion, MIN_AUTH_VERSION_OAUTH2);

  const projectAuthPages = useMemo(
    () =>
      allProjectAuthPages.filter(
        (page) => page.value !== 'oauth2-clients' || isOAuth2Available,
      ),
    [isOAuth2Available],
  );

  const pathSegments = useMemo(() => asPath.split('/'), [asPath]);
  const isAuthPage = pathSegments.includes('auth');
  const authPageFromUrl = isAuthPage ? pathSegments[6] || 'users' : null;

  const selectedAuthPageFromUrl = projectAuthPages.find(
    (item) => item.value === authPageFromUrl,
  );
  const [selectedAuthPage, setSelectedAuthPage] = useState<Option | null>(null);

  useEffect(() => {
    if (selectedAuthPageFromUrl) {
      setSelectedAuthPage({
        label: selectedAuthPageFromUrl.label,
        value: selectedAuthPageFromUrl.value,
        route: selectedAuthPageFromUrl.route,
      });
    }
  }, [selectedAuthPageFromUrl]);

  const options: Option[] = projectAuthPages.map((page) => ({
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
          {selectedAuthPage ? (
            <div>{selectedAuthPage.label}</div>
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
                    setSelectedAuthPage(option);
                    setOpen(false);
                    push(
                      `/orgs/${orgSlug}/projects/${appSubdomain}/auth/${option.route}/`,
                    );
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedAuthPage?.value === option.value
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
