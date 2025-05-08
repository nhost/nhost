import { GithubAuthButton } from '@/features/auth/providers/github/components/GithubAuthButton';

function SignUpWithGithub() {
  return (
    <GithubAuthButton
      withAnonId
      buttonText="Sign Up with GitHub"
      errorText="An error occurred while trying to sign up using GitHub. Please try again."
    />
  );
}

export default SignUpWithGithub;
