import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { ArrowRight, ExternalLink, TriangleAlert } from 'lucide-react';
import { useRef } from 'react';
import { StatusCircle } from '@/components/presentational/StatusCircle';
import { Avatar } from '@/components/ui/v3/avatar';
import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { TextLink } from '@/components/ui/v3/text-link';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { RedeployWarning } from '@/features/orgs/projects/deployments/utils/getRedeployWarning';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { UnifiedDeploymentRowFragment } from '@/generated/graphql';
import { cn } from '@/lib/utils';

const titles: Record<RedeployWarning, string> = {
  older: 'Redeploy an older commit?',
  failed: 'Redeploy a failed commit?',
  aborted: 'Redeploy an aborted commit?',
  different: 'Redeploy a different commit?',
};

const statusLabels = {
  succeeded: 'Deployed',
  DEPLOYED: 'Deployed',
  failed: 'Failed',
  FAILED: 'Failed',
  aborted: 'Aborted',
} as const;

type Status = keyof typeof statusLabels;

function isStatus(status: string | null | undefined): status is Status {
  return status != null && Object.hasOwn(statusLabels, status);
}

interface CommitCardProps {
  label: string;
  deployment: UnifiedDeploymentRowFragment;
  target?: boolean;
}

function CommitCard({ label, deployment, target }: CommitCardProps) {
  const date = deployment.startedAt ?? deployment.createdAt;
  const time = date
    ? formatDistanceToNowStrict(parseISO(date), { addSuffix: true })
    : '';
  const status = isStatus(deployment.status) ? deployment.status : null;
  const statusLabel = status ? statusLabels[status] : 'Unknown';

  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-2 rounded-lg border p-3',
        target && 'border-primary/40 bg-primary/5',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          {label}
        </span>
        <span className="font-mono text-muted-foreground text-xs">
          {deployment.commitSHA?.substring(0, 7)}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <Avatar
          name={deployment.commitUserName ?? undefined}
          alt={deployment.commitUserName ?? undefined}
          src={deployment.commitUserAvatarUrl}
          className="h-6 w-6 shrink-0"
        />
        <span className="truncate font-medium text-sm">
          {deployment.commitMessage?.trim() || 'No commit message'}
        </span>
      </div>
      <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
        <StatusCircle status={status} />
        <span className="truncate">
          {statusLabel} · {time}
        </span>
      </span>
    </div>
  );
}

export interface RedeployDialogProps {
  deployment: UnifiedDeploymentRowFragment;
  liveDeployment: UnifiedDeploymentRowFragment;
  warning: RedeployWarning;
  inProgress: boolean;
  scheduling: boolean;
  onCancel: VoidFunction;
  onConfirm: VoidFunction;
}

export default function RedeployDialog({
  deployment,
  liveDeployment,
  warning,
  inProgress,
  scheduling,
  onCancel,
  onConfirm,
}: RedeployDialogProps) {
  const { project } = useProject();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const rollback = warning === 'older' || warning === 'different';

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
    >
      <DialogContent
        className="sm:max-w-2xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{titles[warning]}</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-warning">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            This isn't the last successful deployment.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-stretch gap-3">
          <CommitCard label="Live now" deployment={liveDeployment} />
          <div className="flex items-center text-muted-foreground">
            <ArrowRight className="h-5 w-5" />
          </div>
          <CommitCard label="Will deploy" deployment={deployment} target />
        </div>
        {rollback && (
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground text-sm">
            <li>
              This commit's metadata, settings and functions replace the current
              ones.
            </li>
            <li>
              <strong className="text-foreground">
                Database migrations are not rolled back.
              </strong>
            </li>
          </ul>
        )}
        <DialogFooter className="sm:items-center sm:justify-between">
          {rollback && (
            <TextLink
              href={`https://github.com/${project?.githubRepository?.fullName}/compare/${deployment.commitSHA}...${liveDeployment.commitSHA}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Compare changes on GitHub{' '}
              <ExternalLink className="ml-1 inline h-3.5 w-3.5" />
            </TextLink>
          )}
          <div className="flex justify-end gap-2 sm:ml-auto">
            <Button ref={cancelRef} variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    disabled={inProgress || scheduling}
                    onClick={onConfirm}
                  >
                    Redeploy
                  </Button>
                </span>
              </TooltipTrigger>
              {inProgress && (
                <TooltipContent>
                  Deployments cannot be re-triggered when a deployment is in
                  progress.
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
