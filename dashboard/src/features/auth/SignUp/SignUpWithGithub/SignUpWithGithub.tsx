import { GithubAuthButton } from '@/features/auth/AuthProviders/Github/components/GithubAuthButton';
import { useHostName } from '@/features/orgs/projects/common/hooks/useHostName';

function SignUpWithGithub() {
  const redirectTo = `${useHostName()}/github-app?signinProvider=github&state=normal-path`;
  return (
    <GithubAuthButton
      redirectTo={redirectTo}
      buttonText="Sign Up with GitHub"
      errorText="An error occurred while trying to sign up using GitHub. Please try again."
    />
  );
}

export default SignUpWithGithub;
