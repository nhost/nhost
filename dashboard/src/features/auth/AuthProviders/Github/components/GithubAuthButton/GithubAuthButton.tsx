import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import {
  useGithubAuthentication,
  type UseGithubAuthenticationHookProps,
} from '@/features/auth/AuthProviders/Github/hooks/useGithubAuthentication';
import { SiGithub } from '@icons-pack/react-simple-icons';

interface Props extends UseGithubAuthenticationHookProps {
  buttonText?: string;
  withAnonId?: boolean;
  redirectTo?: string;
}

function GithubAuthButton({
  buttonText = 'Continue with GitHub',
  withAnonId = false,
  redirectTo,
}: Props) {
  const { mutate: signInWithGithub, isLoading } = useGithubAuthentication({
    withAnonId,
    redirectTo,
  });
  return (
    <Button
      className="gap-2 !bg-white text-sm+ !text-black hover:ring-2 hover:ring-white hover:ring-opacity-50 disabled:!text-black disabled:!text-opacity-60"
      disabled={isLoading}
      loading={isLoading}
      onClick={() => signInWithGithub()}
    >
      <SiGithub size={14} /> {buttonText}
    </Button>
  );
}

export default GithubAuthButton;
