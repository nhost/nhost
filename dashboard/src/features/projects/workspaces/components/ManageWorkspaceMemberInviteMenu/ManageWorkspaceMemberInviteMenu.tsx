import { Modal } from '@/components/ui/v1/Modal';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { RemoveWorkspaceMemberInviteModal } from '@/features/projects/workspaces/components/RemoveWorkspaceMemberInviteModal';
import type { GetWorkspaceMembersWorkspaceMemberInviteFragment } from '@/generated/graphql';
import {
  refetchGetWorkspaceMembersQuery,
  useDeleteWorkspaceMemberInvitesMutation,
  useUpdateWorkspaceMemberInviteMutation,
} from '@/generated/graphql';
import { capitalize } from '@/utils/helpers';
import { triggerToast } from '@/utils/toast';
import { useState } from 'react';

export interface ManageWorkspaceMemberInviteMenuProps {
  /**
   * Object containing workspace member invitation details.
   */
  workspaceMemberInvite: GetWorkspaceMembersWorkspaceMemberInviteFragment;
}

export default function ManageWorkspaceMemberInviteMenu({
  workspaceMemberInvite,
}: ManageWorkspaceMemberInviteMenuProps) {
  const { currentWorkspace } = useCurrentWorkspaceAndProject();
  const [removeMemberInviteModal, setRemoveMemberInviteModal] = useState(false);
  const otherMemberType =
    workspaceMemberInvite.memberType === 'owner' ? 'member' : 'owner';

  const [updateWorkspaceMemberInvite] = useUpdateWorkspaceMemberInviteMutation({
    refetchQueries: [
      refetchGetWorkspaceMembersQuery({ workspaceId: currentWorkspace.id }),
    ],
  });

  const [deleteWorkspaceMemberInvite] = useDeleteWorkspaceMemberInvitesMutation(
    {
      refetchQueries: [
        refetchGetWorkspaceMembersQuery({ workspaceId: currentWorkspace.id }),
      ],
    },
  );

  async function handleRemoveMemberInvite() {
    try {
      await deleteWorkspaceMemberInvite({
        variables: {
          id: workspaceMemberInvite.id,
        },
      });

      setRemoveMemberInviteModal(false);

      triggerToast(`Invitation has been cancelled successfully.`);
    } catch (error) {
      if (error instanceof Error) {
        triggerToast(error.message);
        return;
      }

      triggerToast(`An unknown error occurred while cancelling invitation.`);
    }
  }

  async function handleUpdateMemberType() {
    try {
      await updateWorkspaceMemberInvite({
        variables: {
          id: workspaceMemberInvite.id,
          workspaceMemberInvite: {
            memberType: otherMemberType,
          },
        },
      });

      triggerToast(`Invitation has been updated successfully.`);
    } catch (error) {
      if (error instanceof Error) {
        triggerToast(error.message);
        return;
      }

      triggerToast(`An unknown error occurred while updating invitation.`);
    }
  }

  return (
    <div className="flex items-center justify-center self-center font-display">
      <Modal
        showModal={removeMemberInviteModal}
        close={() => setRemoveMemberInviteModal(false)}
      >
        <RemoveWorkspaceMemberInviteModal
          handler={handleRemoveMemberInvite}
          close={() => setRemoveMemberInviteModal(false)}
        />
      </Modal>

      <Dropdown.Root>
        <Dropdown.Trigger asChild className="gap-1">
          <Button variant="borderless">
            {capitalize(workspaceMemberInvite.memberType)}
          </Button>
        </Dropdown.Trigger>

        <Dropdown.Content
          menu
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Dropdown.Item className="py-2" onClick={handleUpdateMemberType}>
            Change invitation to {otherMemberType}
          </Dropdown.Item>
          <Divider component="li" />
          <Dropdown.Item
            className="py-2"
            sx={{ color: 'error.main' }}
            onClick={() => setRemoveMemberInviteModal(true)}
          >
            Cancel invitation
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Root>
    </div>
  );
}
