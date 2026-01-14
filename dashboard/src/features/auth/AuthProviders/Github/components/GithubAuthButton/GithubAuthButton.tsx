import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import {
  useGithubAuthentication,
  type UseGithubAuthenticationHookProps,
} from '@/features/auth/AuthProviders/Github/hooks/useGithubAuthentication';
import { cn } from '@/lib/utils';
import { SiGithub } from '@icons-pack/react-simple-icons';

interface Props extends UseGithubAuthenticationHookProps {
  buttonText?: string;
  withAnonId?: boolean;
  redirectTo?: string;
  className?: string;
}

function GithubAuthButton({
  buttonText = 'Continue with GitHub',
  withAnonId = false,
  redirectTo,
  className,
}: Props) {
  const { mutate: signInWithGithub, isLoading } = useGithubAuthentication({
    withAnonId,
    redirectTo,
  });
  return (
    <Button
      className={cn(
        '!bg-white !text-black disabled:!text-black disabled:!text-opacity-60 gap-2 text-sm+ hover:ring-2 hover:ring-white hover:ring-opacity-50',
        className,
      )}
      disabled={isLoading}
      loading={isLoading}
      onClick={() => signInWithGithub()}
    >
      <SiGithub size={14} /> {buttonText}
    </Button>
  );
}

export default GithubAuthButton;
