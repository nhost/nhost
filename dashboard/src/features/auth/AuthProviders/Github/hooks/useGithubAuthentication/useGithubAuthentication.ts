import type { SignInProviderParams } from '@nhost/nhost-js/auth';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { isNotEmptyValue } from '@/lib/utils';
import { getToastStyleProps } from '@/utils/constants/settings';
import { nhost } from '@/utils/nhost';

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

      const redirectURL = nhost.auth.signInProviderURL('github', options);
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
