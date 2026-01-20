import { SiGithub } from '@icons-pack/react-simple-icons';
import type { SignInProviderParams } from '@nhost/nhost-js/auth';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import { cn, isNotEmptyValue } from '@/lib/utils';
import { nhost } from '@/utils/nhost';

interface Props {
  buttonText?: string;
  className?: string;
  withAnonId?: boolean;
  redirectTo?: string;
  errorText?: string;
}

function GithubAuthButton({
  buttonText = 'Continue with GitHub',
  withAnonId = false,
  redirectTo,
  className,
}: Props) {
  function signInWithGithub() {
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
