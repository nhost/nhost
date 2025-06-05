import { getToastStyleProps } from '@/utils/constants/settings';
import { useSignInSecurityKey } from '@nhost/nextjs';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

function useSignInWithSecurityKey() {
  const { signInSecurityKey } = useSignInSecurityKey();
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const { replace } = useRouter();

  async function signInWithSecurityKey() {
    setDisabled(true);
    const {
      isError,
      isSuccess,
      needsEmailVerification: _needsEmailVerification,
      error,
    } = await signInSecurityKey();
    if (isError) {
      toast.error(error?.message, getToastStyleProps());
    } else if (_needsEmailVerification) {
      setNeedsEmailVerification(true);
    } else if (isSuccess) {
      replace('/');
    }
    setDisabled(false);
  }

  return { disabled, signInWithSecurityKey, needsEmailVerification };
}

export default useSignInWithSecurityKey;
