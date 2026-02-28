import { GithubAuthButton } from '@/features/auth/AuthProviders/Github/GithubAuthButton';
import { useHostName } from '@/features/orgs/projects/common/hooks/useHostName';

function SignUpWithGithub() {
  const redirectTo = `${useHostName()}?signinProvider=github`;
  return (
    <GithubAuthButton
      redirectTo={redirectTo}
      buttonText="Sign Up with GitHub"
    />
  );
}

export default SignUpWithGithub;
