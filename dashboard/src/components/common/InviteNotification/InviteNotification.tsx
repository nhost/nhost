import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import {
  GetAllWorkspacesAndProjectsDocument,
  GetWorkspaceMemberInvitesToManageDocument,
  useGetWorkspaceMemberInvitesToManageQuery,
} from '@/generated/graphql';
import { useSubmitState } from '@/hooks/useSubmitState';
import { nhost } from '@/utils/nhost';
import { triggerToast } from '@/utils/toast';
import { useApolloClient } from '@apollo/client';
import { alpha } from '@mui/system';
import { useUserData } from '@nhost/nextjs';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function InviteNotification() {
  const user = useUserData();

  const isPlatform = useIsPlatform();
  const client = useApolloClient();
  const router = useRouter();
  const { submitState, setSubmitState } = useSubmitState();
  const { submitState: ignoreState, setSubmitState: setIgnoreState } =
    useSubmitState();

  // @FIX: We probably don't want to poll every ten seconds for possible invites. (We can change later depending on how it works in production.) Maybe just on the workspace page?
  const {
    data,
    loading,
    error,
    refetch: refetchInvitations,
    startPolling,
  } = useGetWorkspaceMemberInvitesToManageQuery({
    variables: {
      userId: user?.id,
    },
    skip: !isPlatform || !user,
  });

  useEffect(() => {
    startPolling(15000);
  }, [startPolling]);

  if (loading) {
    return null;
  }

  if (error) {
    // TODO: Throw error instead and wrap this component in an ErrorBoundary
    // that would handle the error
    return null;
  }

  if (!data || data.workspaceMemberInvites.length === 0) {
    return null;
  }

  const handleInviteAccept = async (
    _event: React.SyntheticEvent<HTMLButtonElement>,
    invite: (typeof data.workspaceMemberInvites)[number],
  ) => {
    setSubmitState({
      error: null,
      loading: true,
    });
    const { res, error: acceptError } = await nhost.functions.call(
      '/accept-workspace-invite',
      {
        workspaceMemberInviteId: invite.id,
        isAccepted: true,
      },
    );

    if (res?.status !== 200) {
      triggerToast('An error occurred when trying to accept the invitation.');

      return setSubmitState({
        error: new Error(acceptError.message),
        loading: false,
      });
    }

    await client.refetchQueries({
      include: [
        GetAllWorkspacesAndProjectsDocument,
        GetWorkspaceMemberInvitesToManageDocument,
      ],
    });
    await router.push(`/${invite.workspace.slug}`);
    await refetchInvitations();
    triggerToast('Workspace invite accepted');
    return setSubmitState({
      error: null,
      loading: false,
    });
  };

  async function handleIgnoreInvitation(
    inviteId: (typeof data.workspaceMemberInvites)[number]['id'],
  ) {
    setIgnoreState({
      loading: true,
      error: null,
    });

    const { error: ignoreError } = await nhost.functions.call(
      '/accept-workspace-invite',
      {
        workspaceMemberInviteId: inviteId,
        isAccepted: false,
      },
    );

    if (ignoreError) {
      triggerToast('An error occurred when trying to ignore the invitation.');

      setIgnoreState({
        loading: false,
        error: new Error(ignoreError.message),
      });

      return;
    }

    // just refetch all data
    await client.refetchQueries({
      include: [
        GetAllWorkspacesAndProjectsDocument,
        GetWorkspaceMemberInvitesToManageDocument,
      ],
    });

    setIgnoreState({
      loading: false,
      error: null,
    });
  }

  return (
    <Box
      className="absolute right-10 z-50 mt-14 w-workspaceSidebar rounded-lg px-6 py-6 text-left"
      sx={{
        backgroundColor: (theme) =>
          theme.palette.mode === 'dark' ? 'grey.200' : 'grey.700',
        borderWidth: (theme) => (theme.palette.mode === 'dark' ? 1 : 0),
        borderColor: (theme) =>
          theme.palette.mode === 'dark' ? theme.palette.grey[400] : 'none',
      }}
    >
      {data?.workspaceMemberInvites?.map(
        (invite: (typeof data.workspaceMemberInvites)[number]) => (
          <div key={invite.id} className="grid grid-flow-row gap-4 text-center">
            <div className="grid grid-flow-row gap-1">
              <Text variant="h3" component="h2" sx={{ color: 'common.white' }}>
                You have been invited to
              </Text>
              <Text variant="h3" component="p" sx={{ color: 'common.white' }}>
                {invite.workspace.name}
              </Text>
            </div>

            <div className="grid grid-flow-row gap-2">
              <Button
                onClick={(e: React.SyntheticEvent<HTMLButtonElement>) =>
                  handleInviteAccept(e, invite)
                }
                loading={submitState.loading}
              >
                Accept Invite
              </Button>

              <Button
                variant="outlined"
                color="secondary"
                sx={{
                  color: 'common.white',
                  '&:hover': {
                    backgroundColor: (theme) =>
                      alpha(theme.palette.common.white, 0.05),
                  },
                  '&:focus': {
                    backgroundColor: (theme) =>
                      alpha(theme.palette.common.white, 0.1),
                  },
                }}
                onClick={() => handleIgnoreInvitation(invite.id)}
                loading={ignoreState.loading}
              >
                Ignore Invite
              </Button>
            </div>
          </div>
        ),
      )}
    </Box>
  );
}
