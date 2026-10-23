import { Button } from '@/components/ui/v3/button';
import { GithubAuthButton } from '@/features/auth/AuthProviders/Github/GithubAuthButton';
import { useHostName } from '@/features/orgs/projects/common/hooks/useHostName';
import { startGitHubConnect } from '@/features/orgs/projects/common/utils/startGitHubConnect';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useAccessToken } from '@/hooks/useAccessToken';

interface GitHubSignInProps {
  connectionRequired: boolean;
}

export default function GitHubSignIn({
  connectionRequired,
}: GitHubSignInProps) {
  const { org } = useCurrentOrg();
  const { project } = useProject();
  const nhostAccessToken = useAccessToken();
  const origin = useHostName();
  const redirectTo = `${origin}/orgs/${org?.slug}/projects/${project?.subdomain}/deployments`;

  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2.5">
      <p className="text-muted-foreground text-xs">
        Sign in with GitHub to also find branches, tags and commits that were
        never deployed.
      </p>
      {connectionRequired ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => startGitHubConnect({ nhostAccessToken, redirectTo })}
        >
          Sign in
        </Button>
      ) : (
        <GithubAuthButton
          variant="outline"
          size="sm"
          buttonText="Sign in"
          redirectTo={`${redirectTo}?signinProvider=github`}
        />
      )}
    </div>
  );
}
