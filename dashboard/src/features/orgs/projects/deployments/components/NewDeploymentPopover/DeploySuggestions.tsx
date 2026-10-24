import { GitBranch, GitCommitHorizontal, Tag } from 'lucide-react';
import { Fragment } from 'react';
import { CommandGroup, CommandItem } from '@/components/ui/v3/command';
import type { useDeploySuggestions } from '@/features/orgs/projects/deployments/hooks/useDeploySuggestions';
import { rankBySha } from '@/features/orgs/projects/deployments/utils/deploy-suggestions';
import type { UnifiedDeploymentRowFragment } from '@/generated/graphql';
import type { GitHubCommit, GitHubMatchingRef } from '@/lib/github';
import DeploymentHistory from './DeploymentHistory';
import MatchedText from './MatchedText';

interface DeploySuggestionsProps {
  suggestions: ReturnType<typeof useDeploySuggestions>;
  query: string;
  productionBranch: string;
  liveDeployment: UnifiedDeploymentRowFragment | null;
  onPickDeployment: (deployment: UnifiedDeploymentRowFragment) => void;
  onPickRef: (ref: GitHubMatchingRef) => void;
  onPickCommit: (commit: GitHubCommit) => void;
}

function RefSuggestions({
  refs,
  kind,
  query,
  onPick,
}: {
  refs: GitHubMatchingRef[];
  kind: 'branches' | 'tags';
  query: string;
  onPick: (ref: GitHubMatchingRef) => void;
}) {
  if (refs.length === 0) {
    return null;
  }
  const Icon = kind === 'branches' ? GitBranch : Tag;
  return (
    <CommandGroup heading={kind === 'branches' ? 'Branches' : 'Tags'}>
      {refs.map((ref) => (
        <CommandItem
          key={ref.qualifiedRef}
          value={`${kind}:${ref.qualifiedRef}`}
          aria-label={`${kind === 'branches' ? 'Branch' : 'Tag'} ${ref.name}`}
          onSelect={() => onPick(ref)}
        >
          <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            <MatchedText text={ref.name} query={query} />
          </span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

export default function DeploySuggestions({
  suggestions: { history, branches, tags, commits },
  query,
  productionBranch,
  liveDeployment,
  onPickDeployment,
  onPickRef,
  onPickCommit,
}: DeploySuggestionsProps) {
  const groups = rankBySha(
    [
      {
        key: 'deployed',
        sha: history.deployments[0]?.commitSHA,
        content: (
          <DeploymentHistory
            {...history}
            query={query}
            liveDeployment={liveDeployment}
            onPick={onPickDeployment}
          />
        ),
      },
      {
        key: 'branches',
        sha: null,
        content: (
          <RefSuggestions
            refs={branches}
            kind="branches"
            query={query}
            onPick={onPickRef}
          />
        ),
      },
      {
        key: 'tags',
        sha: null,
        content: (
          <RefSuggestions
            refs={tags}
            kind="tags"
            query={query}
            onPick={onPickRef}
          />
        ),
      },
      {
        key: 'commits',
        sha: commits[0]?.sha,
        content: commits.length > 0 && (
          <CommandGroup heading={`Commits on ${productionBranch}`}>
            {commits.map((commit) => (
              <CommandItem
                key={commit.sha}
                value={`commit:${commit.sha}`}
                aria-label={`${commit.message.split('\n')[0] || 'No commit message'} ${commit.sha.slice(0, 7)}`}
                onSelect={() => onPickCommit(commit)}
              >
                <GitCommitHorizontal className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  <MatchedText
                    text={commit.message.split('\n')[0] || 'No commit message'}
                    query={query}
                  />
                </span>
                <span className="ml-2 shrink-0 font-mono text-muted-foreground text-xs">
                  <MatchedText text={commit.sha.slice(0, 7)} query={query} />
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ),
      },
    ],
    query,
    (group) => group.sha,
  );
  return groups.map((group) => (
    <Fragment key={group.key}>{group.content}</Fragment>
  ));
}
