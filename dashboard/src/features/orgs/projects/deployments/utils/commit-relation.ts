export interface CommitRelationInput {
  aheadBy: number;
  behindBy: number;
  identical: boolean;
}

export function describeCommitRelation({
  aheadBy,
  behindBy,
  identical,
}: CommitRelationInput): { text: string; warning: boolean } | null {
  if (identical) {
    return null;
  }
  if (behindBy > 0) {
    return {
      text: `${behindBy} commit${behindBy === 1 ? '' : 's'} behind the live deployment`,
      warning: true,
    };
  }
  if (aheadBy > 0) {
    return {
      text: `${aheadBy} commit${aheadBy === 1 ? '' : 's'} ahead of the live deployment`,
      warning: false,
    };
  }
  return null;
}

export function canResolveDeploymentRef(input: string): boolean {
  return input.length > 0 && !/\s/.test(input);
}
