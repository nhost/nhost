import { cn } from '@/lib/utils';

export type PipelineRunStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'aborted'
  | undefined
  | null;

// Legacy deployment statuses (deprecated)
export type DeploymentStatus =
  | 'DEPLOYING'
  | 'DEPLOYED'
  | 'FAILED'
  | 'PENDING'
  | 'SCHEDULED'
  | undefined
  | null;

export type StatusCircleProps = {
  status: PipelineRunStatus | DeploymentStatus;
};

export default function StatusCircle({ status }: StatusCircleProps) {
  const base = 'w-1.5 h-1.5 rounded-full';

  if (status === 'running' || status === 'DEPLOYING') {
    return <span className={cn(base, 'animate-pulse bg-primary')} />;
  }

  if (status === 'pending' || status === 'PENDING' || status === 'SCHEDULED') {
    return <span className={cn(base, 'animate-pulse bg-warning')} />;
  }

  if (status === 'succeeded' || status === 'DEPLOYED') {
    return <span className={cn(base, 'bg-success')} />;
  }

  if (status === 'failed' || status === 'FAILED') {
    return <span className={cn(base, 'bg-destructive')} />;
  }

  return <span className={cn(base, 'bg-muted-foreground')} />;
}
