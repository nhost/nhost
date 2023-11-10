import { useDialog } from '@/components/common/DialogProvider';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Checkbox } from '@/components/ui/v2/Checkbox';
import { Text } from '@/components/ui/v2/Text';
import { getToastStyleProps } from '@/utils/constants/settings';
import { useDeleteUserAccountMutation } from '@/utils/__generated__/graphql';
import { type ApolloError } from '@apollo/client';
import { useSignOut, useUserData } from '@nhost/nextjs';
import { useRouter } from 'next/router';
import { useState } from 'react';
import toast from 'react-hot-toast';
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

  const userData = useUserData();

  const [deleteUserAccount] = useDeleteUserAccountMutation({
    variables: { id: userData?.id },
  });

  const onClickConfirm = async () => {
    setLoadingRemove(true);

    await toast.promise(
      deleteUserAccount(),
      {
        loading: 'Deleting your account...',
        success: `The account has been deleted successfully.`,
        error: (arg: ApolloError) => {
          // we need to get the internal error message from the GraphQL error
          const { internal } = arg.graphQLErrors[0]?.extensions || {};
          const { message } = (internal as Record<string, any>)?.error || {};

          // we use the default Apollo error message if we can't find the
          // internal error message
          return (
            message ||
            arg.message ||
            'An error occurred while deleting your account. Please try again.'
          );
        },
      },
      getToastStyleProps(),
    );

    onDelete?.();
    close();
  };

  return (
    <Box className={twMerge('w-full rounded-lg p-6 text-left')}>
      <div className="grid grid-flow-row gap-1">
        <Text variant="h3" component="h2">
          Delete Account
        </Text>

        <Text variant="subtitle2">
          Are you sure you want to delete your account?
        </Text>

        <Text
          variant="subtitle2"
          className="font-bold"
          sx={{ color: (theme) => `${theme.palette.error.main} !important` }}
        >
          This cannot be undone.
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
            disabled={!remove}
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
    <Button color="error" onClick={confirmDeleteAccount}>
      Delete account
    </Button>
  );
}
