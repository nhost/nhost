import { SiGithub } from '@icons-pack/react-simple-icons';
import type { SignInProviderParams } from '@nhost/nhost-js/auth';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import { appendPkceId, generateAndStorePKCE } from '@/lib/pkce';
import { cn, isNotEmptyValue } from '@/lib/utils';
import { nhost } from '@/utils/nhost';

interface Props {
  buttonText?: string;
  className?: string;
  withAnonId?: boolean;
  redirectTo?: string;
}

function GithubAuthButton({
  buttonText = 'Continue with GitHub',
  withAnonId = false,
  redirectTo,
  className,
}: Props) {
  async function signInWithGithub() {
    const { challenge, id } = await generateAndStorePKCE();

    let options: SignInProviderParams = {
      codeChallenge: challenge,
    };
    if (isNotEmptyValue(redirectTo)) {
      options = {
        ...options,
        redirectTo: appendPkceId(redirectTo, id),
      };
    }
    if (withAnonId) {
      options = {
        ...options,
      };
    }

    const redirectURL = nhost.auth.signInProviderURL('github', options);
    window.location.href = redirectURL;
  }

  return (
    <Button
      className={cn(
        '!bg-white !text-black disabled:!text-black disabled:!text-opacity-60 gap-2 text-sm+ hover:ring-2 hover:ring-white hover:ring-opacity-50',
        className,
      )}
      onClick={signInWithGithub}
    >
      <SiGithub size={14} /> {buttonText}
    </Button>
  );
}

export default GithubAuthButton;
