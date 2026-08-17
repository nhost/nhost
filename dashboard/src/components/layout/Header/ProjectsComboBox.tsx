import { SiGithub } from '@icons-pack/react-simple-icons';
import { Box, Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import HeaderCombobox from '@/components/layout/Header/HeaderCombobox';
import ProjectStatus from '@/components/layout/Header/ProjectStatus';
import { CommandItem, CommandSeparator } from '@/components/ui/v3/command';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { ProjectStatusIndicator } from '@/features/orgs/components/common/ProjectStatusIndicator';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getProjectFeaturePagePath } from '@/utils/getProjectFeaturePagePath';

export default function ProjectsComboBox() {
  const {
    query: { appSubdomain },
    pathname,
    push,
  } = useRouter();

  const { state: appState } = useAppState();
  const { currentOrg: { slug: orgSlug, apps = [] } = {} } = useOrgs();
  const { project } = useProject();
  const isGitHubConnected = !!project?.githubRepository;

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

  const triggerLabel = selectedProjectFromUrl ? (
    <div className="flex items-center gap-2">
      <span className="flex size-2 shrink-0 items-center justify-center">
        <ProjectStatusIndicator status={appState} />
      </span>
      {selectedProjectFromUrl.name}
      {isGitHubConnected && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex items-center">
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
    </div>
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
      triggerLabel={triggerLabel}
      placeholder="Select a project"
      searchPlaceholder="Select a project..."
      footerSlot={footerSlot}
      linkHref={
        selectedProjectFromUrl && orgSlug
          ? `/orgs/${orgSlug}/projects/${selectedProjectFromUrl.subdomain}`
          : undefined
      }
      linkContent={triggerLabel}
      aria-label="Switch project"
      onChange={handleProjectSelect}
    />
  );
}
