import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SiGithub as GitHubIcon } from '@icons-pack/react-simple-icons';
import { ArrowRight, Move, Play, Plus, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
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
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { getUnpauseErrorMessage } from '@/features/orgs/utils/getUnpauseErrorMessage';
import {
  GetOrganizationsDocument,
  GetProjectsDocument,
  type GetProjectsQuery,
  PipelineRunStatus_Enum,
  ServiceState,
  useGetProjectServicesHealthQuery,
  useUnpauseApplicationMutation,
} from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
import { analytics } from '@/lib/segment';
import { cn } from '@/lib/utils';
import { ApplicationStatus } from '@/types/application';
import useProjectOrder from './useProjectOrder';

type Project = GetProjectsQuery['apps'][0];

/**
 * Wakes a paused project from its card, the same mutation as the Wake up on
 * the project itself. The card shows "Waking up" as soon as it's clicked.
 */
function WakeUpButton({
  project,
  onStart,
  onFail,
}: {
  project: Project;
  onStart: () => void;
  onFail: () => void;
}) {
  const userData = useUserData();
  const { org } = useCurrentOrg();
  const [unpauseApplication, { loading }] = useUnpauseApplicationMutation({
    refetchQueries: [
      { query: GetProjectsDocument, variables: { orgSlug: org?.slug } },
      { query: GetOrganizationsDocument, variables: { userId: userData?.id } },
    ],
  });

  async function handleClick() {
    onStart();

    const woke = await execPromiseWithErrorToast(
      async () => {
        await unpauseApplication({ variables: { appId: project.id } });
        analytics.track('Project Resumed', {
          org_id: org?.id ?? null,
          project_id: project.id,
        });
        return true;
      },
      {
        loadingMessage: 'Waking up the project...',
        successMessage: 'The project is waking up.',
        errorMessage: getUnpauseErrorMessage,
      },
    );

    if (!woke) {
      onFail();
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      disabled={loading}
      onClick={handleClick}
      className="relative z-20"
    >
      <Play className="mr-1 h-3.5 w-3.5" />
      Wake up
    </Button>
  );
}

function ProjectCard({
  project,
  dragHandle,
}: {
  project: Project;
  /** Shown right after the title on hover. */
  dragHandle?: ReactNode;
}) {
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
  const isPaused = status === ApplicationStatus.Paused;
  // "Waking up" right after the click, until the next refresh brings the real state.
  const [wakingUp, setWakingUp] = useState(false);
  const shownStatus =
    wakingUp && isPaused ? ApplicationStatus.Unpausing : status;
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

  // The link is a layer under the whole card, not a wrapper: the move icon and
  // Wake up sit outside it, so dragging or pressing them can never open the
  // project.
  return (
    <div className="group relative flex min-h-44 flex-col rounded-lg transition-colors duration-300">
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
              {/* Right after the title, shown on hover or keyboard focus. */}
              {dragHandle && (
                <span className="relative z-20 flex shrink-0 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover/sortable:opacity-100">
                  {dragHandle}
                </span>
              )}
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

          <div className="flex flex-1 flex-row items-start gap-2">
            {showPipelineRun ? (
              <DeploymentStatusMessage pipelineRun={latestPipelineRun} />
            ) : (
              <DeploymentStatusMessage deployment={latestDeployment} />
            )}
          </div>

          <div className="flex w-full flex-row items-center justify-between gap-2">
            {isPaused && !wakingUp ? (
              <WakeUpButton
                project={project}
                onStart={() => setWakingUp(true)}
                onFail={() => setWakingUp(false)}
              />
            ) : (
              <ProjectStatusPill status={shownStatus} />
            )}
            {/* Always on the right (even with no status), nudges right on hover. */}
            <ArrowRight className="ml-auto flex-shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A card that can be dragged by its handle (shown on hover or keyboard focus).
 * While one card moves, the others slide out of its way.
 */
function SortableProjectCard({ project }: { project: Project }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group/sortable relative',
        isDragging && 'z-10 scale-[1.02] opacity-90 shadow-lg',
      )}
    >
      <ProjectCard
        project={project}
        dragHandle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${project.name}`}
            // Inside the card's link: a click here must not open the project.
            className={cn(
              'flex h-6 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:text-foreground',
              isDragging && 'cursor-grabbing',
            )}
          >
            <Move className="h-4 w-4" />
          </button>
        }
      />
    </div>
  );
}

interface ProjectGridProps {
  projects: Project[];
}

export default function ProjectsGrid({ projects }: ProjectGridProps) {
  const { org } = useCurrentOrg();
  const [orderedProjects, saveOrder] = useProjectOrder(org?.slug, projects);
  // A small move before a drag starts, so clicking a card still opens it.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) {
      return;
    }
    const ids = orderedProjects.map((project) => project.id);
    saveOrder(
      arrayMove(
        ids,
        ids.indexOf(String(active.id)),
        ids.indexOf(String(over.id)),
      ),
    );
  }

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
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={orderedProjects.map((project) => project.id)}
            strategy={rectSortingStrategy}
          >
            {orderedProjects.map((project) => (
              <SortableProjectCard key={project.id} project={project} />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
