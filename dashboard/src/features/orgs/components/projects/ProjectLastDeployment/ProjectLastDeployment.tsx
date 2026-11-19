import { formatDistance } from 'date-fns';
import type { LatestDeployment } from '@/features/orgs/components/projects/utils/getLatestDeployment';
import { PipelineRunStatus_Enum } from '@/generated/graphql';
import { cn } from '@/lib/utils';

type Outcome = 'succeeded' | 'failed' | 'aborted' | 'running' | 'other';

const PIPELINE_OUTCOME: Record<string, Outcome> = {
  [PipelineRunStatus_Enum.Succeeded]: 'succeeded',
  [PipelineRunStatus_Enum.Failed]: 'failed',
  [PipelineRunStatus_Enum.Aborted]: 'aborted',
  [PipelineRunStatus_Enum.Pending]: 'running',
  [PipelineRunStatus_Enum.Running]: 'running',
};

// Legacy deployments (deprecated) use their own status names.
const LEGACY_OUTCOME: Record<string, Outcome> = {
  DEPLOYED: 'succeeded',
  FAILED: 'failed',
  SCHEDULED: 'running',
  PENDING: 'running',
  DEPLOYING: 'running',
};

const DOT: Record<Outcome, string> = {
  succeeded: 'bg-success',
  failed: 'bg-destructive',
  aborted: 'bg-muted-foreground',
  running: 'animate-pulse bg-muted-foreground',
  other: 'bg-muted-foreground',
};

function describe({ pipelineRun, deployment }: LatestDeployment) {
  if (pipelineRun) {
    return {
      outcome: PIPELINE_OUTCOME[pipelineRun.status] ?? 'other',
      at: pipelineRun.endedAt ?? pipelineRun.startedAt,
    };
  }
  if (deployment) {
    return {
      outcome: LEGACY_OUTCOME[deployment.deploymentStatus ?? ''] ?? 'other',
      at: deployment.deploymentEndedAt ?? deployment.deploymentStartedAt,
    };
  }
  return null;
}

interface ProjectLastDeploymentProps {
  latest: LatestDeployment;
}

// Only the outcome and when: a green or red dot, with words that say the
// same thing, so the result never depends on colour alone.
export default function ProjectLastDeployment({
  latest,
}: ProjectLastDeploymentProps) {
  const info = describe(latest);

  if (!info) {
    return (
      <span className="text-muted-foreground text-xs">No deployments yet</span>
    );
  }

  const ago = info.at
    ? formatDistance(new Date(info.at), new Date(), { addSuffix: true })
    : null;

  let label = ago ? `Deployed ${ago}` : 'Deployed';
  if (info.outcome === 'failed') {
    label = ago ? `Deploy failed ${ago}` : 'Deploy failed';
  } else if (info.outcome === 'aborted') {
    label = ago ? `Deploy aborted ${ago}` : 'Deploy aborted';
  } else if (info.outcome === 'running') {
    label = 'Deploying now';
  }

  return (
    <span className="flex min-w-0 items-center gap-2 text-muted-foreground text-xs">
      <span
        aria-hidden
        data-outcome={info.outcome}
        className={cn('h-2 w-2 shrink-0 rounded-full', DOT[info.outcome])}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}
