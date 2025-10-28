import { isNotEmptyValue } from '@/lib/utils';
import { getToastStyleProps } from '@/utils/constants/settings';
import { nhost } from '@/utils/nhost';
import type { SignInProviderParams } from '@nhost/nhost-js/auth';
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
          ...options,
        };
      }

      let redirectURL = nhost.auth.signInProviderURL('github', options);
      redirectURL += '&state=normal-path';
      console.log(redirectURL);
      window.location.href = redirectURL;
    },
    {
      onError: () => {
        toast.error(
          errorText || 'Something went wrong. Please try again later.',
          getToastStyleProps(),
        );
      },
    },
  );

  return githubAuthenticationMutation;
}
export default useGithubAuthentication;
