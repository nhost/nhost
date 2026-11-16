import type { ChangePasswordFormValues } from '@/features/account/settings/components/PasswordSettings/hooks/useChangePasswordForm';
import useActionWithElevatedPermissions from '@/features/account/settings/hooks/useActionWithElevatedPermissions';
import { useNhostClient } from '@/providers/nhost';

interface Props {
  onSuccess: () => void;
}

function useOnChangePasswordHandler({ onSuccess }: Props) {
  const nhost = useNhostClient();

  const changePassword = useActionWithElevatedPermissions({
    actionFn: nhost.auth.changeUserPassword,
    onSuccess,
    successMessage: 'The password has been changed successfully.',
  });

  async function onSubmit(values: ChangePasswordFormValues) {
    const { newPassword } = values;

    await changePassword({ newPassword });
  }

  return onSubmit;
}

export default useOnChangePasswordHandler;
