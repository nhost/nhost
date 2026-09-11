import { SiGithub } from '@icons-pack/react-simple-icons';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import HeaderCombobox from '@/components/layout/Header/HeaderCombobox';
import ProjectStatus from '@/components/layout/Header/ProjectStatus';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { ProjectStatusPill } from '@/features/orgs/components/common/ProjectStatusPill';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ApplicationStatus } from '@/types/application';
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

  const options = apps.map((app) => {
    const isSelected = app.subdomain === selectedProjectFromUrl?.subdomain;
    const rowStatus = isSelected
      ? appState
      : (app.appStates[0]?.stateId ?? ApplicationStatus.Empty);

    return {
      value: app.subdomain,
      label: app.name,
      className: isSelected
        ? 'bg-primary/[0.06] font-medium dark:bg-primary/[0.08]'
        : undefined,
      render: (
        <div className="flex w-full items-center gap-2">
          <span className="min-w-0 flex-1 truncate">{app.name}</span>
          <div className="ml-auto flex shrink-0 items-center gap-2">
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
            <ProjectStatusPill status={rowStatus} />
          </div>
        </div>
      ),
    };
  });

  const triggerLabel = selectedProjectFromUrl ? (
    <div className="flex items-center gap-2">
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
      <ProjectStatusPill status={appState} />
      <ProjectStatus />
    </div>
  ) : null;

  const footerSlot = (
    <div className="border-t p-1">
      <button
        type="button"
        onClick={() => {
          if (!orgSlug) {
            return;
          }

          push(`/orgs/${orgSlug}/projects/new`);
        }}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 font-medium text-primary text-sm hover:bg-primary/10"
      >
        <Plus className="h-3.5 w-3.5" />
        New Project
      </button>
    </div>
  );

  return (
    <HeaderCombobox
      options={options}
      value={selectedProjectFromUrl?.subdomain ?? null}
      triggerLabel={triggerLabel}
      placeholder="Select a project"
      searchPlaceholder="Select a project..."
      footerSlot={footerSlot}
      popoverContentClassName="w-[290px]"
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
