import useActionWithElevatedPermissions from '@/features/account/settings/hooks/useActionWithElevatedPermissions';
import useGetSecurityKeys from '@/features/account/settings/hooks/useGetSecurityKeys';
import { useAddSecurityKey } from '@nhost/nextjs';
import { type NewSecurityKeyFormValues } from './useNewSecurityKeyForm';

interface Props {
  onSuccess: () => void;
}

function useOnAddNewSecurityKeyHandler({ onSuccess }: Props) {
  const { refetch } = useGetSecurityKeys();
  const { add: actionFn } = useAddSecurityKey();
  const addSecurityKey = useActionWithElevatedPermissions({
    actionFn,
    onSuccess: async () => {
      await refetch();
      onSuccess();
    },
    successMessage: 'Security key has been added.',
  });

  async function onSubmit(values: NewSecurityKeyFormValues) {
    const { nickname } = values;
    await addSecurityKey(nickname);
  }

  return onSubmit;
}

export default useOnAddNewSecurityKeyHandler;
