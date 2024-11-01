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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { cn } from '@/lib/utils';
import { Box, Check, ChevronsUpDown } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

type Option = {
  value: string;
  label: string;
};

export default function ProjectsComboBox() {
  const {
    query: { appSubdomain },
    push,
  } = useRouter();

  const { currentOrg: { slug: orgSlug, apps = [] } = {} } = useOrgs();
  const selectedProjectFromUrl = apps.find(
    (item) => item.subdomain === appSubdomain,
  );
  const [selectedProject, setSelectedProject] = useState<Option | null>(null);

  useEffect(() => {
    if (selectedProjectFromUrl) {
      setSelectedProject({
        label: selectedProjectFromUrl.name,
        value: selectedProjectFromUrl.subdomain,
      });
    }
  }, [selectedProjectFromUrl]);

  const options: Option[] = apps.map((app) => ({
    label: app.name,
    value: app.subdomain,
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
          {selectedProject ? (
            <div className="flex flex-row items-center justify-center gap-1">
              <Box className="h-4 w-4" />
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
                  keywords={[option.label]}
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    setSelectedProject(option);
                    setOpen(false);
                    push(`/orgs/${orgSlug}/projects/${option.value}`);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedProject?.value === option.value
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                  <div className="flex flex-row items-center gap-1">
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
  );
}
