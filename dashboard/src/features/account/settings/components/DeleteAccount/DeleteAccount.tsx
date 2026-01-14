import { useDialog } from '@/components/common/DialogProvider';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Checkbox } from '@/components/ui/v2/Checkbox';
import { Text } from '@/components/ui/v2/Text';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useUserData } from '@/hooks/useUserData';
import { useAuth } from '@/providers/Auth';
import { useDeleteUserAccountMutation } from '@/utils/__generated__/graphql';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';

function ConfirmDeleteAccountModal({
  close,
  onDelete,
}: {
  onDelete: () => Promise<unknown>;
  close: () => void;
}) {
  const [remove, setRemove] = useState(false);
  const [loadingRemove, setLoadingRemove] = useState(false);

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
  const { signout } = useAuth();

  const { openDialog, closeDialog } = useDialog();

  const onDelete = async () => {
    await signout();
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
