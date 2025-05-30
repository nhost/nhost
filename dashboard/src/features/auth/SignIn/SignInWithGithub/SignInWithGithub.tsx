import { GithubAuthButton } from '@/features/auth/AuthProviders/Github/components/GithubAuthButton';
import { useHostName } from '@/features/orgs/projects/common/hooks/useHostName';

function SignInWithGithub() {
  const redirectTo = useHostName();
  return (
    <GithubAuthButton
      redirectTo={redirectTo}
      buttonText="Continue with GitHub"
      errorText="An error occurred while trying to sign in using GitHub. Please try again later."
    />
  );
}

export default SignInWithGithub;
