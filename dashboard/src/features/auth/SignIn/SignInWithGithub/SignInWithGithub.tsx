import { GithubAuthButton } from '@/features/auth/AuthProviders/Github/GithubAuthButton';
import { useHostName } from '@/features/orgs/projects/common/hooks/useHostName';

function SignInWithGithub() {
  const redirectTo = `${useHostName()}?signinProvider=github`;
  return (
    <GithubAuthButton
      redirectTo={redirectTo}
      buttonText="Continue with GitHub"
    />
  );
}

export default SignInWithGithub;
