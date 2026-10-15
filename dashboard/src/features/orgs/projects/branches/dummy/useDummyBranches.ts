// DUMMY PROTOTYPE DATA. Remove before staging: the real data comes from the
// backend. Everything here lives in localStorage so the prototype feels alive.
import { useCallback, useMemo } from 'react';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';

export type BranchSource = 'manual' | 'github';
export type BranchStatus = 'creating' | 'ready' | 'failed';

export interface Branch {
  id: string;
  name: string;
  isProduction: boolean;
  source: BranchSource;
  gitBranch?: string;
  branchedFrom?: string;
  createdAt: string;
  createdBy: string;
  lastActivityAt: string;
  status: BranchStatus;
}

export type MergeRequestState = 'open' | 'merged' | 'closed';

export interface MergeRequest {
  id: string;
  number: number;
  title: string;
  branchName: string;
  into: string;
  author: string;
  createdAt: string;
  state: MergeRequestState;
  closedAt?: string;
}

interface ProjectBranchesState {
  branches: Branch[];
  mergeRequests: MergeRequest[];
  currentBranchId: string;
  nextNumber: number;
}

const STORAGE_KEY = 'nhost-dummy-branches';
const EMPTY: Record<string, ProjectBranchesState> = {};

const ago = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

function seed(): ProjectBranchesState {
  return {
    currentBranchId: 'production',
    nextNumber: 43,
    branches: [
      {
        id: 'production',
        name: 'production',
        isProduction: true,
        source: 'manual',
        createdAt: ago(60 * 24 * 120),
        createdBy: 'Rui Almeida',
        lastActivityAt: ago(4),
        status: 'ready',
      },
      {
        id: 'b-billing',
        name: 'feature-billing',
        isProduction: false,
        source: 'manual',
        branchedFrom: 'production',
        createdAt: ago(60 * 26),
        createdBy: 'Rui Almeida',
        lastActivityAt: ago(120),
        status: 'ready',
      },
      {
        id: 'b-auth-email',
        name: 'fix-auth-email',
        isProduction: false,
        source: 'github',
        gitBranch: 'fix/auth-email',
        branchedFrom: 'production',
        createdAt: ago(60 * 30),
        createdBy: 'Marta Silva',
        lastActivityAt: ago(60 * 20),
        status: 'ready',
      },
      {
        id: 'b-onboarding',
        name: 'onboarding-flow',
        isProduction: false,
        source: 'manual',
        branchedFrom: 'production',
        createdAt: ago(60 * 24 * 52),
        createdBy: 'Tom Becker',
        lastActivityAt: ago(60 * 24 * 41),
        status: 'ready',
      },
    ],
    mergeRequests: [
      {
        id: 'mr-42',
        number: 42,
        title: 'Add invoices and invoice items',
        branchName: 'feature-billing',
        into: 'production',
        author: 'Rui Almeida',
        createdAt: ago(120),
        state: 'open',
      },
      {
        id: 'mr-41',
        number: 41,
        title: 'Tighten auth.users email constraint',
        branchName: 'fix-auth-email',
        into: 'production',
        author: 'Marta Silva',
        createdAt: ago(60 * 20),
        state: 'open',
      },
      {
        id: 'mr-40',
        number: 40,
        title: 'Add profiles table',
        branchName: 'profiles',
        into: 'production',
        author: 'Tom Becker',
        createdAt: ago(60 * 24 * 6),
        state: 'merged',
        closedAt: ago(60 * 24 * 5),
      },
      {
        id: 'mr-39',
        number: 39,
        title: 'Rename orders.total column',
        branchName: 'orders-cleanup',
        into: 'production',
        author: 'Marta Silva',
        createdAt: ago(60 * 24 * 9),
        state: 'closed',
        closedAt: ago(60 * 24 * 8),
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

export const STALE_AFTER_DAYS = 30;

export function isStale(branch: Branch) {
  return (
    !branch.isProduction &&
    Date.now() - new Date(branch.lastActivityAt).getTime() >
      STALE_AFTER_DAYS * 24 * 60 * 60_000
  );
}

export const DUMMY_GIT_BRANCHES = [
  'feature/checkout',
  'feature/search',
  'fix/auth-email',
  'chore/upgrade-hasura',
];

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

  const openRequestFor = (branchName: string) =>
    state.mergeRequests.find(
      (mr) => mr.branchName === branchName && mr.state === 'open',
    );

  const switchTo = (branchId: string) =>
    update((s) => ({ ...s, currentBranchId: branchId }));

  const createBranch = (input: {
    name: string;
    source: BranchSource;
    gitBranch?: string;
    openRequestsFromGitHub?: boolean;
  }) => {
    const id = `b-${Date.now()}`;
    update((s) => ({
      ...s,
      branches: [
        ...s.branches,
        {
          id,
          name: input.name,
          isProduction: false,
          source: input.source,
          gitBranch: input.gitBranch,
          branchedFrom: 'production',
          createdAt: new Date().toISOString(),
          createdBy: 'You',
          lastActivityAt: new Date().toISOString(),
          status: 'creating',
        },
      ],
    }));
    // Pretend the copy takes a few seconds.
    window.setTimeout(() => {
      update((s) => ({
        ...s,
        branches: s.branches.map((b) =>
          b.id === id ? { ...b, status: 'ready' } : b,
        ),
      }));
    }, 4000);
    return id;
  };

  const deleteBranch = (branchId: string) =>
    update((s) => {
      const branch = s.branches.find((b) => b.id === branchId);
      return {
        ...s,
        currentBranchId:
          s.currentBranchId === branchId ? 'production' : s.currentBranchId,
        branches: s.branches.filter((b) => b.id !== branchId),
        mergeRequests: s.mergeRequests.map((mr) =>
          mr.branchName === branch?.name && mr.state === 'open'
            ? { ...mr, state: 'closed', closedAt: new Date().toISOString() }
            : mr,
        ),
      };
    });

  const openMergeRequest = (branchName: string, title: string) =>
    update((s) => ({
      ...s,
      nextNumber: s.nextNumber + 1,
      mergeRequests: [
        {
          id: `mr-${s.nextNumber}`,
          number: s.nextNumber,
          title,
          branchName,
          into: 'production',
          author: 'You',
          createdAt: new Date().toISOString(),
          state: 'open',
        },
        ...s.mergeRequests,
      ],
    }));

  const merge = (requestId: string, deleteAfter: boolean) =>
    update((s) => {
      const request = s.mergeRequests.find((mr) => mr.id === requestId);
      const branch = s.branches.find((b) => b.name === request?.branchName);
      return {
        ...s,
        currentBranchId:
          deleteAfter && branch && s.currentBranchId === branch.id
            ? 'production'
            : s.currentBranchId,
        branches: deleteAfter
          ? s.branches.filter((b) => b.id !== branch?.id)
          : s.branches,
        mergeRequests: s.mergeRequests.map((mr) =>
          mr.id === requestId
            ? { ...mr, state: 'merged', closedAt: new Date().toISOString() }
            : mr,
        ),
      };
    });

  const closeMergeRequest = (requestId: string) =>
    update((s) => ({
      ...s,
      mergeRequests: s.mergeRequests.map((mr) =>
        mr.id === requestId
          ? { ...mr, state: 'closed', closedAt: new Date().toISOString() }
          : mr,
      ),
    }));

  const resetDemo = () => update(() => seed());

  return {
    isReady: !!project,
    projectName: project?.name ?? 'this project',
    branches: state.branches,
    mergeRequests: state.mergeRequests,
    currentBranch,
    production,
    openRequestFor,
    switchTo,
    createBranch,
    deleteBranch,
    openMergeRequest,
    merge,
    closeMergeRequest,
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
