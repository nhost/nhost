import { useDialog } from '@/components/common/DialogProvider';
import RemoveWorkspaceModal from '@/components/workspace/RemoveWorkspaceModal';
import { useUI } from '@/context/UIContext';
import { useGetWorkspace } from '@/hooks/use-GetWorkspace';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Avatar } from '@/ui/Avatar';
import { Modal } from '@/ui/Modal';
import Button from '@/ui/v2/Button';
import Divider from '@/ui/v2/Divider';
import { Dropdown } from '@/ui/v2/Dropdown';
import Text from '@/ui/v2/Text';
import { copy } from '@/utils/copy';
import { nhost } from '@/utils/nhost';
import Image from 'next/image';
import { useRouter } from 'next/router';

export default function WorkspaceHeader() {
  const { currentWorkspace } = useCurrentWorkspaceAndApplication();
  const {
    query: { workspaceSlug },
  } = useRouter();

  const {
    openDeleteWorkspaceModal,
    closeDeleteWorkspaceModal,
    deleteWorkspaceModal,
  } = useUI();

  const { openDialog } = useDialog();

  const { data } = useGetWorkspace(workspaceSlug);

  const workspace = data?.workspaces[0];

  const user = nhost.auth.getUser();

  const isOwner = workspace?.workspaceMembers.some(
    (member) => member.user.id === user?.id && member.type === 'owner',
  );

  const noApplications = workspace?.apps.length === 0;

  const IS_DEFAULT_WORKSPACE = currentWorkspace.name === 'Default Workspace';

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <Modal
        showModal={deleteWorkspaceModal}
        close={closeDeleteWorkspaceModal}
        Component={RemoveWorkspaceModal}
      />
      <div className="flex flex-row place-content-between">
        <div className="flex flex-row items-center">
          {IS_DEFAULT_WORKSPACE &&
          user.id === currentWorkspace.creatorUserId ? (
            <Avatar
              className="h-14 w-14 self-center rounded-full"
              name={user?.displayName}
              avatarUrl={user?.avatarUrl}
            />
          ) : (
            <div className="inline-block h-14 w-14 overflow-hidden rounded-xl">
              <Image
                src="/logos/new.svg"
                alt="Nhost Logo"
                width={56}
                height={56}
              />
            </div>
          )}

          <div className="flex flex-col items-start pl-3">
            <Text variant="h1" className="font-display text-3xl font-medium">
              {currentWorkspace.name}
            </Text>
            <Button
              variant="borderless"
              color="secondary"
              className="py-1 pl-1 font-display text-xs font-medium"
              onClick={() =>
                copy(
                  `https://app.nhost.io/${currentWorkspace.slug}`,
                  'Workspace URL',
                )
              }
            >
              <Text
                component="span"
                className="text-xs font-medium"
                color="secondary"
              >
                app.nhost.io/
              </Text>
              {currentWorkspace.slug}
            </Button>
          </div>
        </div>

        <div className="hidden self-center sm:block">
          {data && isOwner && (
            <Dropdown.Root>
              <Dropdown.Trigger asChild>
                <Button variant="outlined" color="secondary" className="gap-2">
                  Workspace Options
                </Button>
              </Dropdown.Trigger>

              <Dropdown.Content
                PaperProps={{ className: 'mt-1 w-[280px]' }}
                menu
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              >
                <Dropdown.Item
                  className="py-2"
                  onClick={() => {
                    openDialog('EDIT_WORKSPACE_NAME', {
                      title: (
                        <span className="grid grid-flow-row">
                          <span>Change Workspace Name</span>
                          <Text variant="subtitle1" component="span">
                            Changing the workspace name will also affect the URL
                            of the workspace.
                          </Text>
                        </span>
                      ),
                      payload: {
                        currentWorkspaceName: currentWorkspace.name,
                        currentWorkspaceId: currentWorkspace.id,
                      },
                    });
                  }}
                >
                  Change workspace name
                </Dropdown.Item>

                <Divider component="li" sx={{ margin: 0 }} />

                <Dropdown.Item
                  className="grid grid-flow-row whitespace-pre-wrap py-2 font-medium"
                  disabled={!noApplications}
                  onClick={openDeleteWorkspaceModal}
                  sx={{ color: 'error.main' }}
                >
                  I want to remove this workspace
                  {!noApplications && (
                    <Text
                      variant="caption"
                      className="font-medium"
                      color="disabled"
                    >
                      You can&apos;t remove this workspace because you have apps
                      running. Remove all apps first.
                    </Text>
                  )}
                </Dropdown.Item>
              </Dropdown.Content>
            </Dropdown.Root>
          )}
        </div>
      </div>
    </div>
  );
}
