import useActionWithElevatedPermissions from '@/features/account/settings/hooks/useActionWithElevatedPermissions';
import useGetSecurityKeys from '@/features/account/settings/hooks/useGetSecurityKeys';
import { useNhostClient } from '@/providers/nhost';
import { startRegistration } from '@simplewebauthn/browser';
import { type NewSecurityKeyFormValues } from './useNewSecurityKeyForm';

interface Props {
  onSuccess: () => void;
}

function useOnAddNewSecurityKeyHandler({ onSuccess }: Props) {
  const { refetch } = useGetSecurityKeys();
  const nhost = useNhostClient();

  async function actionFn(nickname: string) {
    const webAuthnOptions = await nhost.auth.addSecurityKey();
    const credential = await startRegistration(webAuthnOptions.body);
    await nhost.auth.verifyAddSecurityKey({ credential, nickname });
  }

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
