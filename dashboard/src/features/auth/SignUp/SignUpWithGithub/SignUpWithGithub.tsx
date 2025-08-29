import { GithubAuthButton } from '@/features/auth/AuthProviders/Github/components/GithubAuthButton';

function SignUpWithGithub() {
  return (
    <GithubAuthButton
      buttonText="Sign Up with GitHub"
      errorText="An error occurred while trying to sign up using GitHub. Please try again."
    />
  );
}

export default SignUpWithGithub;
