import { SiGithub } from '@icons-pack/react-simple-icons';
import ProjectStatus from '@/components/layout/Header/ProjectStatus';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { ProjectStatusPill } from '@/features/orgs/components/common/ProjectStatusPill';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export interface ProjectLabelProps {
  name: string;
}

/**
 * The current project as shown in the header triggers: name, GitHub marker,
 * status pill and the updating badge.
 */
export default function ProjectLabel({ name }: ProjectLabelProps) {
  const { state: appState } = useAppState();
  const { project } = useProject();
  const isGitHubConnected = !!project?.githubRepository;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="truncate" title={name}>
        {name}
      </span>
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
      <ProjectStatusPill status={appState} size="compact" />
      <ProjectStatus />
    </div>
  );
}
