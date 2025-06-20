import { getAnonId } from '@/lib/segment';
import { isNotEmptyValue } from '@/lib/utils';
import { getToastStyleProps } from '@/utils/constants/settings';
import { nhost } from '@/utils/nhost';
import type { SignInProviderParams } from '@nhost/nhost-js-beta/auth';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

export interface UseGithubAuthenticationHookProps {
  withAnonId?: boolean;
  redirectTo?: string;
  errorText?: string;
}

function useGithubAuthentication({
  withAnonId = false,
  redirectTo,
  errorText,
}: UseGithubAuthenticationHookProps) {
  const githubAuthenticationMutation = useMutation(
    async () => {
      let options: SignInProviderParams | undefined;
      if (isNotEmptyValue(redirectTo)) {
        options = {
          redirectTo,
        };
      }
      if (withAnonId) {
        options = {
          metadata: { anonId: await getAnonId() },
          ...options,
        };
      }

      const redirectURl = nhost.auth.signInProviderURL('github', options);
      window.location.href = redirectURl;
    },
    {
      onError: () => {
        toast.error(errorText, getToastStyleProps());
      },
    },
  );

  return githubAuthenticationMutation;
}
export default useGithubAuthentication;
