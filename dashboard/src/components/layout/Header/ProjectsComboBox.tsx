import ProjectStatus from '@/components/layout/Header/ProjectStatus';
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
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/v3/hover-card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { cn } from '@/lib/utils';
import { ApplicationStatus } from '@/types/application';
import { Box, Check, ChevronsUpDown } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

type Option = {
  value: string;
  label: string;
};

function ProjectStatusIndicator({ status }: { status: ApplicationStatus }) {
  const indicatorStyles: Record<
    number,
    { className: string; description: string }
  > = {
    [ApplicationStatus.Errored]: {
      className: 'bg-destructive',
      description: 'Project errored',
    },
    [ApplicationStatus.Pausing]: {
      className: 'bg-primary-main animate-blinking',
      description: 'Project is pausing',
    },
    [ApplicationStatus.Restoring]: {
      className: 'bg-primary-main animate-blinking',
      description: 'Project is restoring',
    },
    [ApplicationStatus.Paused]: {
      className: 'bg-slate-400',
      description: 'Project is paused',
    },
    [ApplicationStatus.Unpausing]: {
      className: 'bg-primary-main animate-blinking',
      description: 'Project is unpausing',
    },
    [ApplicationStatus.Live]: {
      className: 'bg-primary-main',
      description: 'Project is live',
    },
  };
  const style = indicatorStyles[status];

  if (style) {
    return (
      <HoverCard openDelay={0}>
        <HoverCardTrigger asChild>
          <span
            className={cn('mt-[1px] h-2 w-2 rounded-full', style.className)}
          />
        </HoverCardTrigger>
        <HoverCardContent side="top" className="h-fit w-fit py-2">
          {style.description}
        </HoverCardContent>
      </HoverCard>
    );
  }

  return null;
}

export default function ProjectsComboBox() {
  const {
    query: { appSubdomain },
    push,
  } = useRouter();

  const { state: appState } = useAppState();
  const { currentOrg: { slug: orgSlug, apps = [] } = {} } = useOrgs();

  const [selectedProject, setSelectedProject] = useState<Option | null>(null);
  const [open, setOpen] = useState(false);

  const options: Option[] = apps.map((app) => ({
    label: app.name,
    value: app.subdomain,
  }));

  const selectedProjectFromUrl = apps.find(
    (app) => app.subdomain === appSubdomain,
  );

  useEffect(() => {
    if (selectedProjectFromUrl) {
      setSelectedProject({
        label: selectedProjectFromUrl.name,
        value: selectedProjectFromUrl.subdomain,
      });
    }
  }, [selectedProjectFromUrl]);

  const handleProjectSelect = (option: Option) => {
    setSelectedProject(option);
    setOpen(false);
    push(`/orgs/${orgSlug}/projects/${option.value}`);
  };

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-2 bg-background text-foreground hover:bg-accent dark:hover:bg-muted"
          >
            {selectedProject ? (
              <div className="flex items-center gap-2">
                <ProjectStatusIndicator status={appState} />
                {selectedProject.label}
                <ProjectStatus />
              </div>
            ) : (
              <>Select a project</>
            )}
            <ChevronsUpDown className="h-5 w-5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0" side="bottom" align="start">
          <Command>
            <CommandInput placeholder="Select a project..." />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleProjectSelect(option)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedProject?.value === option.value
                          ? 'opacity-100'
                          : 'opacity-0',
                      )}
                    />
                    <div className="flex items-center gap-1">
                      <Box className="h-4 w-4" />
                      <span className="max-w-52 truncate">{option.label}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
