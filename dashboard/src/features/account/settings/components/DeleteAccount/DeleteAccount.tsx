import { useDialog } from '@/components/common/DialogProvider';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Checkbox } from '@/components/ui/v2/Checkbox';
import { Text } from '@/components/ui/v2/Text';
import {
  useDeleteUserAccountMutation,
  useGetAllWorkspacesAndProjectsQuery,
} from '@/utils/__generated__/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { useSignOut, useUserData } from '@nhost/nextjs';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';

function ConfirmDeleteAccountModal({
  close,
  onDelete,
}: {
  onDelete?: () => Promise<any>;
  close: () => void;
}) {
  const [remove, setRemove] = useState(false);
  const [loadingRemove, setLoadingRemove] = useState(false);

  const user = useUserData();

  const { data, loading } = useGetAllWorkspacesAndProjectsQuery({
    skip: !user,
  });

  const userHasProjects =
    !loading && data?.workspaces.some((workspace) => workspace.projects.length);

  const userData = useUserData();

  const [deleteUserAccount] = useDeleteUserAccountMutation({
    variables: { id: userData?.id },
  });

  const onClickConfirm = async () => {
    setLoadingRemove(true);

    await execPromiseWithErrorToast(
      async () => {
        await deleteUserAccount();
        onDelete?.();
        close();
      },
      {
        loadingMessage: 'Deleting your account...',
        successMessage: 'The account has been deleted successfully.',
        errorMessage:
          'An error occurred while deleting your account. Please try again.',
      },
    );
  };

  return (
    <Box className={twMerge('w-full rounded-lg p-6 text-left')}>
      <div className="grid grid-flow-row gap-1">
        <Text variant="h3" component="h2">
          Delete Account?
        </Text>

        {userHasProjects && (
          <Text
            variant="subtitle2"
            className="font-bold"
            sx={{ color: (theme) => `${theme.palette.error.main} !important` }}
          >
            You still have active projects. Please delete your projects before
            proceeding with the account deletion.
          </Text>
        )}

        <Box className="my-4">
          <Checkbox
            id="accept-1"
            label={`I'm sure I want to delete my account`}
            className="py-2"
            checked={remove}
            onChange={(_event, checked) => setRemove(checked)}
            aria-label="Confirm Delete Project #1"
          />
        </Box>

        <div className="grid grid-flow-row gap-2">
          <Button
            color="error"
            onClick={onClickConfirm}
            disabled={userHasProjects}
            loading={loadingRemove}
          >
            Delete
          </Button>

          <Button variant="outlined" color="secondary" onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </Box>
  );
}

export default function DeleteAccount() {
  const router = useRouter();
  const { signOut } = useSignOut();

  const { openDialog, closeDialog } = useDialog();

  const onDelete = async () => {
    await signOut();
    await router.push('/signin');
  };

  const confirmDeleteAccount = async () => {
    openDialog({
      component: (
        <ConfirmDeleteAccountModal close={closeDialog} onDelete={onDelete} />
      ),
    });
  };

  return (
    <SettingsContainer
      title="Delete Account"
      description="Please proceed with caution as the removal of your Personal Account and its contents from the Nhost platform is irreversible. This action will permanently delete your account and all associated data."
      className="px-0"
      slotProps={{
        submitButton: { className: 'hidden' },
        footer: { className: 'hidden' },
      }}
    >
      <Box className="grid grid-flow-row border-t-1">
        <Button
          color="error"
          className="mx-4 mt-4 justify-self-end"
          onClick={confirmDeleteAccount}
        >
          Delete Personal Account
        </Button>
      </Box>
    </SettingsContainer>
  );
}
