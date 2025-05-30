import useActionWithElevatedPermissions from '@/features/account/settings/hooks/useActionWithElevatedPermissions';
import { useChangePassword } from '@nhost/nextjs';
import { type ChangePasswordFormValues } from './useChangePasswordForm';

interface Props {
  onSuccess: () => void;
}

function useOnChangePasswordHandler({ onSuccess }: Props) {
  const { changePassword: actionFn } = useChangePassword();

  const changePassword = useActionWithElevatedPermissions({
    actionFn,
    onSuccess,
    successMessage: 'The password has been changed successfully.',
  });

  async function onSubmit(values: ChangePasswordFormValues) {
    const { newPassword } = values;

    await changePassword(newPassword);
  }

  return onSubmit;
}

export default useOnChangePasswordHandler;
