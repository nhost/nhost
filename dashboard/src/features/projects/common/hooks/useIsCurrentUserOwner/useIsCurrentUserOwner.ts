import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useUserData } from '@nhost/nextjs';

/**
 * Returns true if the current user is the owner of the current workspace.
 *
 * @returns True if the current user is the owner of the current workspace.
 */
export default function useIsCurrentUserOwner() {
  const { currentWorkspace, loading } = useCurrentWorkspaceAndProject();
  const currentUser = useUserData();

  if (loading || !currentWorkspace?.workspaceMembers || !currentUser) {
    return false;
  }

  return currentWorkspace.workspaceMembers.some(
    (member) => member.user.id === currentUser.id && member.type === 'owner',
  );
}
