import { ArrowRight, Play, Plus } from 'lucide-react';
import Link from 'next/link';
import { type MouseEvent, useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { ProjectStatusPill } from '@/features/orgs/components/common/ProjectStatusPill';
import { DeploymentStatusMessage } from '@/features/orgs/projects/deployments/components/DeploymentStatusMessage';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { getUnpauseErrorMessage } from '@/features/orgs/utils/getUnpauseErrorMessage';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import {
  GetOrganizationsDocument,
  type GetProjectsQuery,
  useUnpauseApplicationMutation,
} from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
import { ApplicationStatus } from '@/types/application';

type Project = GetProjectsQuery['apps'][0];

/**
 * Shortcut for waking up a paused project directly from its card, instead of
 * having to open the project and go to Settings. Reuses the exact same
 * mutation (and error handling) as the "Wake up" button on the project's
 * Settings page - this is only a new entry point, not a new feature.
 *
 * The card owns whether a wake up was triggered (so it can flip the status
 * pill over to "Project is waking up" the moment this button is clicked,
 * instead of waiting on the next poll of the projects list).
 */
function WakeUpProjectButton({
  projectId,
  onTriggered,
  onFailed,
}: {
  projectId: string;
  onTriggered: () => void;
  onFailed: () => void;
}) {
  const userData = useUserData();

  const [unpauseApplication, { loading }] = useUnpauseApplicationMutation({
    refetchQueries: [
      {
        query: GetOrganizationsDocument,
        variables: { userId: userData?.id },
      },
    ],
  });

  const handleWakeUp = async (event: MouseEvent<HTMLButtonElement>) => {
    // This button lives inside the card's own link - don't navigate.
    event.preventDefault();
    event.stopPropagation();

    onTriggered();

    const result = await execPromiseWithErrorToast(
      () => unpauseApplication({ variables: { appId: projectId } }),
      {
        loadingMessage: 'Waking up the project...',
        successMessage: 'The project is waking up.',
        errorMessage: getUnpauseErrorMessage,
      },
    );

    if (!result) {
      // The mutation failed - let the user try again.
      onFailed();
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      disabled={loading}
      onClick={handleWakeUp}
      className="flex-shrink-0 gap-1"
    >
      <Play className="h-3.5 w-3.5" />
      Wake up
    </Button>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const { org } = useCurrentOrg();
  const [wakeUpTriggered, setWakeUpTriggered] = useState(false);

  const realStatus = project.appStates[0]?.stateId;
  const isPaused = realStatus === ApplicationStatus.Paused;

  // Once "Wake up" is clicked, show the project as unpausing right away
  // instead of waiting for the projects list to poll again. As soon as the
  // real status moves past "Paused" this stops doing anything - the actual
  // status just takes over.
  const displayStatus =
    wakeUpTriggered && isPaused ? ApplicationStatus.Unpausing : realStatus;

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

  return (
    <Link
      href={`/orgs/${org?.slug}/projects/${project.subdomain}`}
      className="group relative block h-44 rounded-lg transition-colors duration-300"
    >
      <div className="relative h-full overflow-hidden rounded-lg p-[2px]">
        <div
          className="absolute inset-0 rounded-lg opacity-0 transition-opacity duration-200 [--card-border-angle:0deg] [--card-border-base:hsl(var(--primary)/15%)] [--card-border-glow:hsl(var(--primary)/85%)] group-hover:animate-card-border-sweep group-hover:opacity-100 dark:[--card-border-base:hsl(var(--primary)/20%)] dark:[--card-border-glow:hsl(var(--primary)/90%)]"
          style={{
            background:
              'conic-gradient(from var(--card-border-angle), var(--card-border-base) 80%, var(--card-border-glow) 87%, var(--card-border-base) 96%)',
          }}
        />
        <div className="relative flex h-full cursor-pointer flex-col gap-4 overflow-hidden rounded-[6px] border bg-background p-4 transition-colors duration-300 group-hover:border-primary/50">
          <div className="flex flex-row items-start gap-2">
            <div className="flex w-full flex-col overflow-hidden">
              <p title={project.name} className="truncate font-bold">
                {project.name}
              </p>
              <span className="text-muted-foreground text-xs">
                {project.region.name}
              </span>
            </div>
          </div>

          <div className="flex flex-1 flex-row items-start gap-2">
            {showPipelineRun ? (
              <DeploymentStatusMessage pipelineRun={latestPipelineRun} />
            ) : (
              <DeploymentStatusMessage deployment={latestDeployment} />
            )}
          </div>

          <div className="flex w-full flex-row items-end justify-between gap-2">
            <div className="flex min-w-0 flex-row items-center gap-2">
              {isPaused && !wakeUpTriggered ? (
                <WakeUpProjectButton
                  projectId={project.id}
                  onTriggered={() => setWakeUpTriggered(true)}
                  onFailed={() => setWakeUpTriggered(false)}
                />
              ) : (
                <ProjectStatusPill status={displayStatus} />
              )}
            </div>
            <ArrowRight className="flex-shrink-0" />
          </div>
        </div>
      </div>
    </Link>
  );
}

interface ProjectGridProps {
  projects: Project[];
}

export default function ProjectsGrid({ projects }: ProjectGridProps) {
  const { org } = useCurrentOrg();

  return (
    <div className="mx-auto h-full overflow-auto bg-accent-background pb-16">
      <div className="mx-auto flex w-full max-w-5xl flex-shrink-0 flex-row items-center justify-between gap-2 px-5 pb-4 pt-8">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Button asChild>
          <Link href={`/orgs/${org?.slug}/projects/new`}>
            <div className="flex h-fit flex-row items-center justify-center space-x-2">
              <Plus className="h-5 w-5" strokeWidth={2} />
              <span>Create project</span>
            </div>
          </Link>
        </Button>
      </div>
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
