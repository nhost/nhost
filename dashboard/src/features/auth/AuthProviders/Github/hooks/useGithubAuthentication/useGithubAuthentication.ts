import { getAnonId } from '@/lib/segment';
import { isNotEmptyValue } from '@/lib/utils';
import { getToastStyleProps } from '@/utils/constants/settings';
import { nhost } from '@/utils/nhost';
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
      const options = {
        ...(isNotEmptyValue(redirectTo) && { redirectTo }),
        ...(withAnonId && { metadata: { anonId: await getAnonId() } }),
      };
      return nhost.auth.signIn({
        provider: 'github',
        ...(isNotEmptyValue(options) && { options }),
      });
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
