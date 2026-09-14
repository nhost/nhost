import { SiGithub } from '@icons-pack/react-simple-icons';
import { Box, Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import HeaderCombobox from '@/components/layout/Header/HeaderCombobox';
import ProjectLabel from '@/components/layout/Header/ProjectLabel';
import { CommandItem, CommandSeparator } from '@/components/ui/v3/command';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { getProjectFeaturePagePath } from '@/utils/getProjectFeaturePagePath';

export default function ProjectsComboBox() {
  const {
    query: { appSubdomain },
    pathname,
    push,
  } = useRouter();

  const { currentOrg: { slug: orgSlug, apps = [] } = {} } = useOrgs();

  const selectedProjectFromUrl = apps.find(
    (app) => app.subdomain === appSubdomain,
  );

  const handleProjectSelect = (subdomain: string) => {
    const featurePath = getProjectFeaturePagePath(pathname);
    push(`/orgs/${orgSlug}/projects/${subdomain}${featurePath}`);
  };

  const options = apps.map((app) => ({
    value: app.subdomain,
    label: app.name,
    render: (
      <div className="flex w-full items-center gap-1">
        <Box className="h-4 w-4 shrink-0" />
        <span className="max-w-52 truncate">{app.name}</span>
        {!!app.githubRepository && (
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
                Metadata changes may be overridden by the next deployment.
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    ),
  }));

  const selectedLabel = selectedProjectFromUrl ? (
    <ProjectLabel name={selectedProjectFromUrl.name} />
  ) : null;

  const footerSlot = (
    <>
      <CommandSeparator className="mt-1" />
      <CommandItem
        forceMount
        value="new-project"
        onSelect={() => {
          if (!orgSlug) {
            return;
          }

          push(`/orgs/${orgSlug}/projects/new`);
        }}
      >
        <Plus className="mr-2 h-4 w-4" />
        New Project
      </CommandItem>
    </>
  );

  return (
    <HeaderCombobox
      options={options}
      value={selectedProjectFromUrl?.subdomain ?? null}
      placeholder="Select a project"
      searchPlaceholder="Select a project..."
      footerSlot={footerSlot}
      linkHref={
        selectedProjectFromUrl && orgSlug
          ? `/orgs/${orgSlug}/projects/${selectedProjectFromUrl.subdomain}`
          : undefined
      }
      linkContent={selectedLabel}
      aria-label="Switch project"
      onChange={handleProjectSelect}
    />
  );
}
