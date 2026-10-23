export interface RedeployTarget {
  commitSHA?: string | null;
  createdAt?: string | null;
  status?: string | null;
}

export type RedeployWarning = 'older' | 'failed' | 'aborted' | 'different';

/**
 * Returns why redeploying `target` needs confirmation, or `null` when it can
 * be scheduled right away: nothing is live or it is the live commit.
 */
export default function getRedeployWarning(
  target: RedeployTarget,
  live: RedeployTarget | null,
): RedeployWarning | null {
  if (!live || target.commitSHA === live.commitSHA) {
    return null;
  }

  if (
    target.createdAt &&
    live.createdAt &&
    new Date(target.createdAt).getTime() < new Date(live.createdAt).getTime()
  ) {
    return 'older';
  }
  if (target.status === 'failed' || target.status === 'FAILED') {
    return 'failed';
  }
  if (target.status === 'aborted') {
    return 'aborted';
  }
  return 'different';
}
