import { useRouter } from 'next/router';
import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { TextLink } from '@/components/ui/v3/text-link';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';

function GitHubConnectedNotice() {
  return (
    <Alert variant="info">
      <AlertTitle>GitHub repository connected</AlertTitle>
      <AlertDescription>
        Run <InlineCode>nhost config pull</InlineCode> to sync your changes. To
        connect multiple projects to the same repository, use{' '}
        <TextLink
          href="https://docs.nhost.io/platform/cli/configuration-overlays"
          target="_blank"
          rel="noreferrer"
        >
          configuration overlays
        </TextLink>
        .
      </AlertDescription>
    </Alert>
  );
}

/**
 * The column every project settings page renders into: one width, the
 * GitHub sync reminder while a repository is connected, and the redirect to
 * 404 when settings are disabled for the environment.
 */
export default function SettingsLayout({ children }: PropsWithChildren) {
  const { project } = useProject();
  const hasGitRepo = !!project?.githubRepository;
  const isSettingsDisabled = useSettingsDisabled();
  const router = useRouter();

  useEffect(() => {
    if (isSettingsDisabled) {
      router.push('/404');
    }
  }, [router, isSettingsDisabled]);

  if (isSettingsDisabled) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-6">
      <RetryableErrorBoundary>
        <div className="grid grid-flow-row gap-6">
          {hasGitRepo && <GitHubConnectedNotice />}
          {children}
        </div>
      </RetryableErrorBoundary>
    </div>
  );
}
