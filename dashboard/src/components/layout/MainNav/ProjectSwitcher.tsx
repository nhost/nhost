import { SiGithub } from '@icons-pack/react-simple-icons';
import { Box, Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import ProjectStatus from '@/components/layout/Header/ProjectStatus';
import { Button } from '@/components/ui/v3/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/v3/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { ProjectStatusIndicator } from '@/features/orgs/components/common/ProjectStatusIndicator';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { cn } from '@/lib/utils';
import { getProjectFeaturePagePath } from '@/utils/getProjectFeaturePagePath';

export default function ProjectSwitcher() {
  const { query, pathname, push } = useRouter();
  const appSubdomain = query.appSubdomain as string | undefined;

  const isPlatform = useIsPlatform();
  const { state: appState } = useAppState();
  const { currentOrg: { slug: orgSlug, apps = [] } = {} } = useOrgs();
  const currentApp = apps.find((app) => app.subdomain === appSubdomain);

  const [open, setOpen] = useState(false);

  const isGitHubConnected = !!currentApp?.githubRepository;

  const handleSelect = (subdomain: string) => {
    setOpen(false);
    if (subdomain === appSubdomain) {
      return;
    }
    const featurePath = getProjectFeaturePagePath(pathname);
    push(`/orgs/${orgSlug}/projects/${subdomain}${featurePath}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-full justify-between gap-2 px-2 text-foreground hover:bg-accent dark:hover:bg-muted"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold text-sm">
              {currentApp?.name ?? 'Select project'}
            </span>
            {currentApp && <ProjectStatusIndicator status={appState} />}
            {isGitHubConnected && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex shrink-0 items-center">
                    <SiGithub className="h-3.5 w-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  sideOffset={8}
                  className="pointer-events-none max-w-56"
                >
                  <p className="font-medium">GitHub connected</p>
                  <p className="text-muted-foreground">
                    Metadata changes may be overridden by the next deployment.
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
            <ProjectStatus />
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" side="bottom" align="start">
        <Command>
          <CommandInput placeholder="Select project..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Projects">
              {apps.map((app) => (
                <CommandItem
                  key={app.subdomain}
                  value={app.subdomain}
                  keywords={[app.name]}
                  onSelect={() => handleSelect(app.subdomain)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      appSubdomain === app.subdomain
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                  <div className="flex w-full items-center gap-1">
                    <Box className="h-4 w-4 shrink-0" />
                    <span className="max-w-52 truncate">{app.name}</span>
                    {app.githubRepository && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="ml-auto flex shrink-0 items-center">
                            <SiGithub className="h-3.5 w-3.5" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="right"
                          sideOffset={8}
                          className="pointer-events-none max-w-56"
                        >
                          <p className="font-medium">GitHub connected</p>
                          <p className="text-muted-foreground">
                            Metadata changes may be overridden by the next
                            deployment.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {isPlatform && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setOpen(false);
                      push(`/orgs/${orgSlug}/projects/new`);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    <span>New Project</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
