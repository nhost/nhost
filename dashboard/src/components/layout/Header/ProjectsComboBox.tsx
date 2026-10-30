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
import { ProjectStatusPill } from '@/features/orgs/components/common/ProjectStatusPill';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { getProjectSwitchHref } from '@/utils/getProjectSwitchHref';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

export default function ProjectsComboBox() {
  const { query, pathname, push } = useRouter();
  const { appSubdomain } = query;

  const { currentOrg: { slug: orgSlug, apps = [] } = {} } = useOrgs();

  const selectedProjectFromUrl = apps.find(
    (app) => app.subdomain === appSubdomain,
  );

  const handleProjectSelect = (subdomain: string) => {
    if (!orgSlug) {
      return;
    }

    push(
      getProjectSwitchHref({
        pathname,
        tab: getSingleQueryParam(query.tab),
        orgSlug,
        subdomain,
      }),
    );
  };

  // Oldest first, the same order as the projects page, so rows never move.
  const options = [...apps]
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .map((app) => ({
      value: app.subdomain,
      label: app.name,
      render: (
        <div className="flex w-full items-center gap-1">
          <Box className="h-4 w-4 shrink-0" />
          <span className="max-w-52 truncate">{app.name}</span>
          <span className="ml-auto flex shrink-0 items-center gap-2">
            {!!app.githubRepository && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex shrink-0 items-center">
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
            <ProjectStatusPill
              status={app.appStates[0]?.stateId}
              size="compact"
            />
          </span>
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
      // Room for the name, the GitHub mark and the status pill on each row.
      popoverContentClassName="w-[260px]"
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
