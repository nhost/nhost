import RemoveWorkspaceMemberInvite from '@/components/workspace/RemoveWorkspaceMemberInvite';
import type { GetWorkspaceMembersWorkspaceMemberInviteFragment } from '@/generated/graphql';
import {
  refetchGetWorkspaceMembersQuery,
  useDeleteWorkspaceMemberInvitesMutation,
  useUpdateWorkspaceMemberInviteMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Loading from '@/ui/Loading';
import { Modal } from '@/ui/Modal';
import { Text } from '@/ui/Text';
import { triggerToast } from '@/utils/toast';
import { Menu, Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/solid';
import { useState } from 'react';

export interface WorkspaceMemberManageMenuProps {
  /**
   * Object containing workspace member invitation details.
   */
  workspaceMemberInvite: GetWorkspaceMembersWorkspaceMemberInviteFragment;
}

export function WorkspaceMemberInviteManageMenu({
  workspaceMemberInvite,
}: WorkspaceMemberManageMenuProps) {
  const { currentWorkspace } = useCurrentWorkspaceAndApplication();
  const [removeMemberInviteModal, setRemoveMemberInviteModal] = useState(false);
  const otherMemberType =
    workspaceMemberInvite.memberType === 'owner' ? 'member' : 'owner';

  const [updateWorkspaceMemberInvite, { loading: updateLoading }] =
    useUpdateWorkspaceMemberInviteMutation({
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
        <RemoveWorkspaceMemberInvite
          handler={handleRemoveMemberInvite}
          close={() => setRemoveMemberInviteModal(false)}
        />
      </Modal>

      <div className="relative inline-block text-left">
        <Menu>
          {({ open }) => (
            <>
              <Menu.Button className="self-center font-display text-sm font-medium capitalize text-blue">
                {workspaceMemberInvite.memberType}
                <ChevronDownIcon className="inline-flex h-4 w-4 self-center text-blue" />
              </Menu.Button>

              <Transition
                show={open}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items
                  static
                  className="absolute right-0 z-20 flex flex-col rounded-md border border-gray-200 bg-white shadow-lg outline-none"
                >
                  <div className="w-drop border-b px-4 py-4">
                    <Menu.Item>
                      <Text
                        className="grid cursor-pointer grid-flow-col place-content-start items-center gap-2 font-medium"
                        color="greyscaleDark"
                        size="normal"
                        onClick={handleUpdateMemberType}
                      >
                        {updateLoading && <Loading />}
                        Change invite to {otherMemberType}
                      </Text>
                    </Menu.Item>
                  </div>
                  <div className="px-4 py-4">
                    <Menu.Item>
                      <Text
                        className="grid cursor-pointer grid-flow-col place-content-start items-center gap-2 font-medium"
                        color="greyscaleDark"
                        size="normal"
                        onClick={() => setRemoveMemberInviteModal(true)}
                      >
                        Cancel invite
                      </Text>
                    </Menu.Item>
                  </div>
                </Menu.Items>
              </Transition>
            </>
          )}
        </Menu>
      </div>
    </div>
  );
}
