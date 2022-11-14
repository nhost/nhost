import RemoveWorkspaceMember from '@/components/workspace/RemoveWorkspaceMember';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Loading from '@/ui/Loading';
import { Modal } from '@/ui/Modal';
import { Text } from '@/ui/Text';
import { triggerToast } from '@/utils/toast';
import type { GetWorkspaceMembersWorkspaceMemberFragment } from '@/utils/__generated__/graphql';
import {
  refetchGetWorkspaceMembersQuery,
  useDeleteWorkspaceMemberMutation,
  useUpdateWorkspaceMemberMutation,
} from '@/utils/__generated__/graphql';
import { Menu, Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/solid';
import { useState } from 'react';

type WorkspaceMemberManageMenuParams = {
  workspaceMember: GetWorkspaceMembersWorkspaceMemberFragment;
};

export function WorkspaceMemberManageMenu({
  workspaceMember,
}: WorkspaceMemberManageMenuParams) {
  const { currentWorkspace } = useCurrentWorkspaceAndApplication();
  const [removeMemberModal, setRemoveMemberModal] = useState(false);
  const otherMemberType = workspaceMember.type === 'owner' ? 'member' : 'owner';

  const [updateWorkspaceMember, { loading: updateLoading }] =
    useUpdateWorkspaceMemberMutation({
      refetchQueries: [
        refetchGetWorkspaceMembersQuery({
          workspaceId: currentWorkspace.id,
        }),
      ],
    });

  const [deleteWorkspaceMember] = useDeleteWorkspaceMemberMutation({
    refetchQueries: [
      refetchGetWorkspaceMembersQuery({
        workspaceId: currentWorkspace.id,
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
        <RemoveWorkspaceMember
          handler={handleRemoveMember}
          close={() => setRemoveMemberModal(false)}
        />
      </Modal>

      <div className="relative inline-block text-left">
        <Menu>
          {({ open }) => (
            <>
              <Menu.Button className="self-center font-display text-sm font-medium capitalize text-blue">
                {workspaceMember.type}
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
                        Make {otherMemberType}
                      </Text>
                    </Menu.Item>
                  </div>
                  <div className="px-4 py-4">
                    <Menu.Item>
                      <Text
                        className="grid cursor-pointer grid-flow-col place-content-start items-center gap-2 font-medium"
                        color="greyscaleDark"
                        size="normal"
                        onClick={() => setRemoveMemberModal(true)}
                      >
                        Remove from workspace
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

export default WorkspaceMemberManageMenu;
