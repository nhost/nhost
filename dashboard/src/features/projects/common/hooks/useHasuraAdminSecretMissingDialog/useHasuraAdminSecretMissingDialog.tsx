import { useDialog } from '@/components/common/DialogProvider';
import { HasuraAdminSecretForm } from '@/components/common/HasuraAdminSecretForm';
import { useEffect } from 'react';

export default function useHasuraAdminSecretMissing(error: Error) {
  const { openDialog } = useDialog();

  useEffect(() => {
    if (
      error &&
      error instanceof Error &&
      error.message === 'invalid x-hasura-admin-secret/x-hasura-access-key'
    ) {
      openDialog({
        title: 'Please Type your Hasura Admin Secret',
        component: <HasuraAdminSecretForm />,
        props: {
          disableEscapeKeyDown: true,
        },
      });
    }
  }, [error, openDialog]);
}
