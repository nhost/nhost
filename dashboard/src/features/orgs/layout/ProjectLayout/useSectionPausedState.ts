import { useRouter } from 'next/router';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { isProjectPaused } from './isProjectPaused';
import { requiresRunningProject } from './projectStatePages';

/**
 * Whether the current route's content should be replaced with the
 * paused-project screen right now, plus the state to pass it. Shared by
 * ProjectSectionContent (tab-bar sections) and any section with its own
 * hand-built layout (e.g. Events) that still needs the same gating.
 */
export function useSectionPausedState() {
  const { route } = useRouter();
  const { state } = useAppState();

  return {
    isBlocked: isProjectPaused(state) && requiresRunningProject(route),
    state,
  };
}
