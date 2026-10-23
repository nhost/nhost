import {
  StatusCircle,
  type StatusCircleProps,
} from '@/components/presentational/StatusCircle';
import { CommandGroup, CommandItem } from '@/components/ui/v3/command';
import { LiveBadge } from '@/features/orgs/projects/deployments/components/LiveBadge';
import type { UnifiedDeploymentRowFragment } from '@/generated/graphql';
import MatchedText from './MatchedText';

interface DeploymentHistoryProps {
  deployments: UnifiedDeploymentRowFragment[];
  query: string;
  loading: boolean;
  error: boolean;
  liveDeployment: UnifiedDeploymentRowFragment | null;
  onPick: (deployment: UnifiedDeploymentRowFragment) => void;
}

export default function DeploymentHistory({
  deployments,
  query,
  loading,
  error,
  liveDeployment,
  onPick,
}: DeploymentHistoryProps) {
  return (
    <CommandGroup heading="Deployed before">
      {loading && (
        <p className="px-2 py-1.5 text-muted-foreground text-xs">
          Loading deployments...
        </p>
      )}
      {error && (
        <p className="px-2 py-1.5 text-muted-foreground text-xs">
          Couldn't load deployment history
        </p>
      )}
      {!loading && !error && deployments.length === 0 && (
        <p className="px-2 py-1.5 text-muted-foreground text-xs">
          No matching deployments
        </p>
      )}
      {deployments.map((deployment) => (
        <CommandItem
          key={deployment.commitSHA}
          value={`deployed:${deployment.commitSHA}`}
          aria-label={`${deployment.commitMessage?.split('\n')[0] || 'No commit message'} ${deployment.id === liveDeployment?.id ? 'Live ' : ''}${deployment.commitSHA?.slice(0, 7) ?? ''}`}
          onSelect={() => onPick(deployment)}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <StatusCircle
              status={deployment.status as StatusCircleProps['status']}
            />
            <span className="truncate">
              <MatchedText
                text={
                  deployment.commitMessage?.split('\n')[0] ||
                  'No commit message'
                }
                query={query}
              />
            </span>
            {deployment.id === liveDeployment?.id && <LiveBadge />}
            <span className="ml-auto shrink-0 font-mono text-muted-foreground text-xs">
              <MatchedText
                text={deployment.commitSHA?.slice(0, 7) ?? ''}
                query={query}
              />
            </span>
          </div>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
