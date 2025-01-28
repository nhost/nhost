import { Modal } from '@/components/ui/v1/Modal';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { RemoveWorkspaceMemberModal } from '@/features/projects/workspaces/components/RemoveWorkspaceMemberModal';
import type { GetWorkspaceMembersWorkspaceMemberFragment } from '@/utils/__generated__/graphql';
import {
  refetchGetWorkspaceMembersQuery,
  useDeleteWorkspaceMemberMutation,
  useUpdateWorkspaceMemberMutation,
} from '@/utils/__generated__/graphql';
import { capitalize } from '@/utils/helpers';
import { triggerToast } from '@/utils/toast';
import { useState } from 'react';

export type ManageWorkspaceMemberMenuProps = {
  workspaceMember: GetWorkspaceMembersWorkspaceMemberFragment;
};

export default function ManageWorkspaceMemberMenu({
  workspaceMember,
}: ManageWorkspaceMemberMenuProps) {
  const { currentWorkspace } = useCurrentWorkspaceAndProject();
  const [removeMemberModal, setRemoveMemberModal] = useState(false);
  const otherMemberType = workspaceMember.type === 'owner' ? 'member' : 'owner';

  const [updateWorkspaceMember] = useUpdateWorkspaceMemberMutation({
    refetchQueries: [
      refetchGetWorkspaceMembersQuery({
        workspaceId: currentWorkspace?.id,
      }),
    ],
  });

  const [deleteWorkspaceMember] = useDeleteWorkspaceMemberMutation({
    refetchQueries: [
      refetchGetWorkspaceMembersQuery({
        workspaceId: currentWorkspace?.id,
      }),
    ],
  });

  async function handleRemoveMember() {
    try {
      await deleteWorkspaceMember({
        variables: {
          id: workspaceMember.id,
        },
      });

      setRemoveMemberModal(false);

      triggerToast(`Member has been removed successfully.`);
    } catch (error) {
      if (error instanceof Error) {
        triggerToast(error.message);

        return;
      }

      triggerToast(`An unknown error occurred while removing member.`);
    }
  }

  async function handleUpdateMemberType() {
    try {
      await updateWorkspaceMember({
        variables: {
          id: workspaceMember.id,
          workspaceMember: {
            type: otherMemberType,
          },
        },
      });

      triggerToast(`Member has been updated successfully.`);
    } catch (error) {
      if (error instanceof Error) {
        triggerToast(error.message);

        return;
      }

      triggerToast(`An unknown error occurred while updating member.`);
    }
  }

  return (
    <div className="flex items-center justify-center self-center font-display">
      <Modal
        showModal={removeMemberModal}
        close={() => setRemoveMemberModal(false)}
      >
        <RemoveWorkspaceMemberModal
          handler={handleRemoveMember}
          close={() => setRemoveMemberModal(false)}
        />
      </Modal>

      <Dropdown.Root>
        <Dropdown.Trigger asChild className="gap-1">
          <Button variant="borderless">
            {capitalize(workspaceMember.type)}
          </Button>
        </Dropdown.Trigger>

        <Dropdown.Content
          menu
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Dropdown.Item className="py-2" onClick={handleUpdateMemberType}>
            Make {otherMemberType}
          </Dropdown.Item>
          <Divider component="li" />
          <Dropdown.Item
            className="py-2"
            sx={{ color: 'error.main' }}
            onClick={() => setRemoveMemberModal(true)}
          >
            Remove from workspace
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Root>
    </div>
  );
}
