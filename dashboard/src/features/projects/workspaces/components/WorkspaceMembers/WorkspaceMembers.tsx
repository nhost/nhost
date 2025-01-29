import { Alert } from '@/components/ui/v2/Alert';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsCurrentUserOwner } from '@/features/projects/common/hooks/useIsCurrentUserOwner';
import { PendingWorkspaceMemberInvitation } from '@/features/projects/workspaces/components/PendingWorkspaceMemberInvitation';
import { WorkspaceMember } from '@/features/projects/workspaces/components/WorkspaceMember';
import {
  refetchGetWorkspaceMembersQuery,
  useGetWorkspaceMembersQuery,
  useInsertWorkspaceMemberInviteMutation,
} from '@/utils/__generated__/graphql';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { triggerToast } from '@/utils/toast';
import { useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import validator from 'validator';

function WorkspaceMemberInviteForm({
  workspaceMembers,
  setWorkspaceInviteError,
  isOwner,
}: any) {
  const [email, setEmail] = useState('');

  const { currentWorkspace } = useCurrentWorkspaceAndProject();

  const [insertWorkspaceMemberInvite] = useInsertWorkspaceMemberInviteMutation({
    refetchQueries: [
      refetchGetWorkspaceMembersQuery({
        workspaceId: currentWorkspace.id,
      }),
    ],
  });

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setWorkspaceInviteError();

    // Check if email is not already part of workspaceMembers.
    // I think it's fine to do this client side only for now.
    if (workspaceMembers.some((member) => member.user.email === email)) {
      setWorkspaceInviteError('User is already member of workspace.');
      return;
    }

    if (!validator.isEmail(email)) {
      setWorkspaceInviteError('Not a valid email address');

      return;
    }

    await execPromiseWithErrorToast(
      async () => {
        await insertWorkspaceMemberInvite({
          variables: {
            workspaceMemberInvite: {
              workspaceId: currentWorkspace.id,
              email,
              memberType: 'member',
            },
          },
        });

        triggerToast(
          `Invite to join workspace ${currentWorkspace.name} sent to ${email}.`,
        );
      },
      {
        loadingMessage: 'Sending invite...',
        successMessage: 'The invite has been sent successfully.',
        errorMessage: `Error trying to invite to ${email} to ${currentWorkspace.name}`,
        onError: async (error) => {
          await discordAnnounce(
            `Error trying to invite to ${email} to ${currentWorkspace.name} ${error.message}`,
          );

          if (
            error.message ===
            'Foreign key violation. insert or update on table "workspace_member_invites" violates foreign key constraint "workspace_member_invites_email_fkey"'
          ) {
            setWorkspaceInviteError(
              'You can only invite users that are already registered at Nhost. Ask the person to register an account, then invite them again.',
            );
          }
        },
      },
    );

    setEmail('');
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-flow-col gap-2">
      <Input
        placeholder="Send invite over email (e.g. name@mycompany.com)"
        className="col-span-10"
        type="email"
        value={email}
        disabled={!isOwner}
        fullWidth
        hideEmptyHelperText
        onChange={(event) => {
          setWorkspaceInviteError('');
          setEmail(event.target.value);
        }}
      />

      <Button
        type="submit"
        variant="outlined"
        color="secondary"
        disabled={!email || !isOwner}
        className="w-38 justify-self-stretch"
      >
        Send Invite
      </Button>
    </form>
  );
}

export default function WorkspaceMembers() {
  const [workspaceInviteError, setWorkspaceInviteError] = useState('');
  const { currentWorkspace } = useCurrentWorkspaceAndProject();
  const isOwner = useIsCurrentUserOwner();

  const { data, loading } = useGetWorkspaceMembersQuery({
    variables: {
      workspaceId: currentWorkspace.id,
    },
    fetchPolicy: 'cache-first',
  });

  return (
    <div className="mx-auto mt-18 max-w-3xl font-display">
      <div className="mb-2 grid grid-flow-row gap-1">
        <Text variant="h3">Members</Text>
        <Text color="secondary" className="text-sm">
          People in this workspace can manage all projects listed above.
        </Text>
      </div>

      {isOwner && (
        <WorkspaceMemberInviteForm
          workspaceMembers={data?.workspace?.workspaceMembers}
          setWorkspaceInviteError={setWorkspaceInviteError}
          isOwner={isOwner}
        />
      )}

      {workspaceInviteError && (
        <Alert severity="error" className="my-2">
          {workspaceInviteError}
        </Alert>
      )}

      {loading ?? <Skeleton height={60} count={3} />}

      {data?.workspace?.workspaceMembers.map((workspaceMember) => (
        <WorkspaceMember
          key={workspaceMember.id}
          workspaceMember={workspaceMember}
          isOwner={isOwner}
        />
      ))}

      {data?.workspace?.workspaceMemberInvites.length > 0 && (
        <div className="mt-12">
          <Text className="mb-2 text-lg font-medium">Pending Invitations</Text>
          {data?.workspace?.workspaceMemberInvites.map(
            (workspaceMemberInvite) => (
              <PendingWorkspaceMemberInvitation
                key={workspaceMemberInvite.id}
                workspaceMemberInvite={workspaceMemberInvite}
                isOwner={isOwner}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
