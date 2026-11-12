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
  createdAt: string;
  createdBy: string;
  lastActivityAt: string;
  status: BranchStatus;
}

interface ProjectBranchesState {
  branches: Branch[];
  currentBranchId: string;
  /** DUMMY: lets the prototype show the "no GitHub" state. */
  githubConnected: boolean;
}

// v2: branches are git only (no manual branches, no merge requests).
const STORAGE_KEY = 'nhost-dummy-branches-v2';
const EMPTY: Record<string, ProjectBranchesState> = {};

/** Comes from the backend (per plan). Production doesn't count. */
export const BRANCH_LIMIT = 5;

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
        lastActivityAt: ago(4),
        status: 'ready',
      },
      {
        id: 'b-billing',
        name: 'feature-billing',
        isProduction: false,
        gitBranch: 'feature/billing',
        pullRequest: 42,
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
  const state = useMemo(() => all[projectId] ?? seed(), [all, projectId]);

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

  const switchTo = (branchId: string) =>
    update((s) => ({ ...s, currentBranchId: branchId }));

  const renameBranch = (branchId: string, name: string) =>
    update((s) => ({
      ...s,
      branches: s.branches.map((b) => (b.id === branchId ? { ...b, name } : b)),
    }));

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
    branchLimit: BRANCH_LIMIT,
    atLimit: branchCount >= BRANCH_LIMIT,
    githubConnected: state.githubConnected,
    switchTo,
    renameBranch,
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
