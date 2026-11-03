import { SiGithub as GitHubIcon } from '@icons-pack/react-simple-icons';
import { ArrowRight, Plus, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { ProjectStatusPill } from '@/features/orgs/components/common/ProjectStatusPill';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { DeploymentStatusMessage } from '@/features/orgs/projects/deployments/components/DeploymentStatusMessage';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { baseServices } from '@/features/orgs/projects/overview/health';
import {
  type GetProjectsQuery,
  PipelineRunStatus_Enum,
  ServiceState,
  useGetProjectServicesHealthQuery,
} from '@/generated/graphql';
import { ApplicationStatus } from '@/types/application';

export type Project = GetProjectsQuery['apps'][0];

export function ProjectCard({ project }: { project: Project }) {
  const { org } = useCurrentOrg();

  const [latestPipelineRun] = project.pipelineRuns;
  const [latestDeployment] = project.deployments;

  // Show whichever is more recent between pipelinerun and legacy deployment
  const prDate = latestPipelineRun?.startedAt
    ? new Date(latestPipelineRun.startedAt).getTime()
    : 0;
  const depDate = latestDeployment?.deploymentStartedAt
    ? new Date(latestDeployment.deploymentStartedAt).getTime()
    : 0;

  const showPipelineRun = prDate >= depDate && latestPipelineRun;

  const isPlatform = useIsPlatform();
  const status = project.appStates[0]?.stateId;
  const isLive = status === ApplicationStatus.Live;
  // Same check as the project's Project health section, only for live projects.
  const { data: health } = useGetProjectServicesHealthQuery({
    variables: { appId: project.id },
    skip: !isPlatform || !isLive,
  });

  // Everything that needs attention, one line each for the warning tooltip.
  const issues: string[] = [];
  for (const service of health?.getProjectStatus?.services ?? []) {
    const name =
      baseServices[service.name as keyof typeof baseServices]?.displayName ??
      service.name;
    if (service.state === ServiceState.Error) {
      issues.push(`${name} has an error`);
    } else if (service.state === ServiceState.UpdateError) {
      issues.push(`${name} failed to update`);
    } else if (service.state === ServiceState.None) {
      issues.push(`${name} isn't running`);
    }
  }
  const deploymentFailed = showPipelineRun
    ? latestPipelineRun.status === PipelineRunStatus_Enum.Failed
    : latestDeployment?.deploymentStatus === 'FAILED';
  if (deploymentFailed) {
    issues.push('The last deployment failed');
  }

  // The link is a layer under the whole card, not a wrapper: the warning icon
  // sits above it, so its tooltip opens without opening the project.
  return (
    <div className="group relative flex h-full min-h-44 flex-col rounded-lg transition-colors duration-300">
      <Link
        href={`/orgs/${org?.slug}/projects/${project.subdomain}`}
        aria-label={`Open ${project.name}`}
        className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-lg p-[2px]">
        {/* On hover a light sweeps around the border once (card-border-sweep). */}
        <div
          className="absolute inset-0 rounded-lg opacity-0 transition-opacity duration-200 [--card-border-angle:0deg] [--card-border-base:hsl(var(--primary)/15%)] [--card-border-glow:hsl(var(--primary)/85%)] group-hover:animate-card-border-sweep group-hover:opacity-100 dark:[--card-border-base:hsl(var(--primary)/20%)] dark:[--card-border-glow:hsl(var(--primary)/90%)]"
          style={{
            background:
              'conic-gradient(from var(--card-border-angle), var(--card-border-base) 80%, var(--card-border-glow) 87%, var(--card-border-base) 96%)',
          }}
        />
        <div className="relative flex flex-1 cursor-pointer flex-col gap-4 overflow-hidden rounded-[6px] border bg-background p-4 transition-colors duration-300 group-hover:border-primary/50">
          <div className="flex flex-col gap-0.5 overflow-hidden">
            <div className="flex items-center gap-2">
              <p title={project.name} className="truncate font-bold text-lg">
                {project.name}
              </p>
              {issues.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TriangleAlert
                      aria-label={issues.join('. ')}
                      className="relative z-20 ml-auto h-4 w-4 flex-shrink-0 text-warning"
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <ul className="flex flex-col gap-1">
                      {issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {project.githubRepository && (
              <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
                <GitHubIcon className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">
                  {project.githubRepository.fullName}
                  {project.repositoryProductionBranch &&
                    ` · ${project.repositoryProductionBranch}`}
                </span>
              </span>
            )}
          </div>

          {/* Deployments come from GitHub pushes: without a repo there is
              nothing to show, so the spot stays empty. */}
          <div className="flex flex-1 flex-row items-start gap-2">
            {(project.githubRepository ||
              latestPipelineRun ||
              latestDeployment) &&
              (showPipelineRun ? (
                <DeploymentStatusMessage pipelineRun={latestPipelineRun} />
              ) : (
                <DeploymentStatusMessage deployment={latestDeployment} />
              ))}
          </div>

          <div className="flex w-full flex-row items-center justify-between gap-2">
            <ProjectStatusPill status={status} />
            {/* Always on the right (even with no status), nudges right on hover. */}
            <ArrowRight className="ml-auto flex-shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface ProjectGridProps {
  projects: Project[];
}

export default function ProjectsGrid({ projects }: ProjectGridProps) {
  const { org } = useCurrentOrg();

  return (
    <div className="mx-auto h-full overflow-auto bg-background pb-16">
      <div className="mx-auto flex w-full max-w-5xl flex-shrink-0 flex-row items-center justify-between gap-2 px-5 pt-8 pb-4">
        <h1 className="font-semibold text-3xl">Projects</h1>
        <Button asChild>
          <Link href={`/orgs/${org?.slug}/projects/new`}>
            <Plus className="mr-2 h-5 w-5" strokeWidth={2} />
            Create project
          </Link>
        </Button>
      </div>
      {/* auto-rows-fr: every row as tall as the tallest card, deployment or not. */}
      <div className="mx-auto grid w-full max-w-5xl auto-rows-fr grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
