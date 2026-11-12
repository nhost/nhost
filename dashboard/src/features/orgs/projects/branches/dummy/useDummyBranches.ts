// DUMMY PROTOTYPE DATA. Remove before staging: the real data comes from the
// backend. Everything here lives in localStorage so the prototype feels alive.
import { useCallback, useMemo } from 'react';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';

/**
 * Every branch comes from git: production follows the default branch, every
 * other branch follows a pull request's git branch. There are no manual
 * branches.
 */
// paused and deleting aren't confirmed by the backend yet; designed for in
// case they exist.
export type BranchStatus =
  | 'creating'
  | 'deploying'
  | 'ready'
  | 'failed'
  | 'paused'
  | 'deleting';

export interface Branch {
  id: string;
  name: string;
  isProduction: boolean;
  gitBranch: string;
  pullRequest?: number;
  /** The pull request's title on GitHub: what the branch is for. */
  pullRequestTitle?: string;
  createdAt: string;
  createdBy: string;
  lastActivityAt: string;
  /** Who made the latest push (lastActivityAt is when). */
  lastPushBy?: string;
  status: BranchStatus;
}

interface ProjectBranchesState {
  branches: Branch[];
  currentBranchId: string;
  /** Creates a branch for every pull request. */
  automaticBranching?: boolean;
  /** Most branches at once (production doesn't count). Set by the user. */
  branchLimit?: number;
  /** DUMMY: lets the prototype show the "no GitHub" state. */
  githubConnected: boolean;
}

// v2: branches are git only (no manual branches, no merge requests).
const STORAGE_KEY = 'nhost-dummy-branches-v2';
const EMPTY: Record<string, ProjectBranchesState> = {};

/**
 * Default branch limit. The user can change it (David and Nuno: no hard cap,
 * a sanity default like 3 or 5). Production doesn't count.
 */
export const DEFAULT_BRANCH_LIMIT = 5;

const ago = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

function seed(): ProjectBranchesState {
  return {
    currentBranchId: 'production',
    githubConnected: true,
    branches: [
      {
        id: 'production',
        name: 'production',
        isProduction: true,
        gitBranch: 'main',
        createdAt: ago(60 * 24 * 120),
        createdBy: 'Rui Almeida',
        lastPushBy: 'Rui Almeida',
        lastActivityAt: ago(4),
        status: 'ready',
      },
      {
        id: 'b-billing',
        name: 'feature-billing',
        isProduction: false,
        gitBranch: 'feature/billing',
        pullRequest: 42,
        pullRequestTitle: 'Add invoices and invoice items',
        lastPushBy: 'Marta Silva',
        createdAt: ago(60 * 26),
        createdBy: 'Rui Almeida',
        lastActivityAt: ago(120),
        status: 'ready',
      },
      {
        id: 'b-auth-email',
        name: 'fix-auth-email',
        isProduction: false,
        gitBranch: 'fix/auth-email',
        pullRequest: 41,
        pullRequestTitle: 'Tighten the auth.users email constraint',
        lastPushBy: 'Marta Silva',
        createdAt: ago(60 * 30),
        createdBy: 'Marta Silva',
        lastActivityAt: ago(2),
        status: 'deploying',
      },
      {
        id: 'b-search',
        name: 'feature-search',
        isProduction: false,
        gitBranch: 'feature/search',
        pullRequest: 44,
        pullRequestTitle: 'Full text search on posts',
        lastPushBy: 'Tom Becker',
        createdAt: ago(60 * 3),
        createdBy: 'Tom Becker',
        lastActivityAt: ago(60 * 3),
        status: 'failed',
      },
      {
        id: 'b-onboarding',
        name: 'onboarding-flow',
        isProduction: false,
        gitBranch: 'feature/onboarding-flow',
        pullRequest: 37,
        pullRequestTitle: 'New onboarding flow',
        lastPushBy: 'Tom Becker',
        createdAt: ago(60 * 24 * 52),
        createdBy: 'Tom Becker',
        lastActivityAt: ago(60 * 24 * 41),
        status: 'ready',
      },
    ],
  };
}

/** Branch names: lowercase letters, numbers and single hyphens. */
export function toBranchSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-/, '');
}

export function useDummyBranches() {
  const { project } = useProject();
  const projectId = project?.id ?? 'unknown';
  const [all, setAll] = useSSRLocalStorage(STORAGE_KEY, EMPTY);
  const state = useMemo(() => {
    const saved = all[projectId];
    if (!saved) {
      return seed();
    }
    // Older demo data misses newer fields: fill them in from the seed so
    // nobody has to reset (and lose their settings).
    const fresh = seed().branches;
    return {
      ...saved,
      branches: saved.branches.map((b) => {
        const s = fresh.find((f) => f.id === b.id);
        return s
          ? {
              ...b,
              pullRequestTitle: b.pullRequestTitle ?? s.pullRequestTitle,
              lastPushBy: b.lastPushBy ?? s.lastPushBy,
            }
          : b;
      }),
    };
  }, [all, projectId]);

  const update = useCallback(
    (fn: (s: ProjectBranchesState) => ProjectBranchesState) => {
      const raw =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(STORAGE_KEY)
          : null;
      const latest: Record<string, ProjectBranchesState> = raw
        ? JSON.parse(raw)
        : {};
      setAll({ ...latest, [projectId]: fn(latest[projectId] ?? seed()) });
    },
    [projectId, setAll],
  );

  const currentBranch =
    state.branches.find((b) => b.id === state.currentBranchId) ??
    state.branches[0];
  const production = state.branches.find((b) => b.isProduction)!;
  const branchCount = state.branches.filter((b) => !b.isProduction).length;
  // Older demo data has no settings yet: fall back to the defaults.
  const automaticBranching = state.automaticBranching ?? true;
  const branchLimit = state.branchLimit ?? DEFAULT_BRANCH_LIMIT;

  const switchTo = (branchId: string) =>
    update((s) => ({ ...s, currentBranchId: branchId }));

  const renameBranch = (branchId: string, name: string) =>
    update((s) => ({
      ...s,
      branches: s.branches.map((b) => (b.id === branchId ? { ...b, name } : b)),
    }));

  const saveSettings = (input: {
    automaticBranching: boolean;
    branchLimit: number;
  }) => update((s) => ({ ...s, ...input }));

  const setGithubConnected = (connected: boolean) =>
    update((s) => ({
      ...s,
      githubConnected: connected,
      currentBranchId: connected ? s.currentBranchId : 'production',
    }));

  const resetDemo = () => update(() => seed());

  return {
    isReady: !!project,
    projectName: project?.name ?? 'this project',
    repository:
      project?.githubRepository?.fullName ??
      `nhost/${project?.subdomain ?? 'project'}`,
    branches: state.branches,
    currentBranch,
    production,
    branchCount,
    automaticBranching,
    branchLimit,
    atLimit: automaticBranching && branchCount >= branchLimit,
    githubConnected: state.githubConnected,
    switchTo,
    renameBranch,
    saveSettings,
    setGithubConnected,
    resetDemo,
  };
}

export function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} h ago`;
  }
  const days = Math.round(hours / 24);
  if (days === 1) {
    return 'yesterday';
  }
  return `${days} days ago`;
}
