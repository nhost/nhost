import { GithubAuthButton } from '@/features/auth/AuthProviders/Github/GithubAuthButton';
import { useHostName } from '@/features/orgs/projects/common/hooks/useHostName';
import { cn } from '@/lib/utils';

export interface SignInWithGithubProps {
  className?: string;
}

function SignInWithGithub({ className }: SignInWithGithubProps) {
  const redirectTo = `${useHostName()}?signinProvider=github`;
  return (
    <GithubAuthButton
      redirectTo={redirectTo}
      buttonText="Continue with GitHub"
      className={cn('w-full', className)}
    />
  );
}

export default SignInWithGithub;
