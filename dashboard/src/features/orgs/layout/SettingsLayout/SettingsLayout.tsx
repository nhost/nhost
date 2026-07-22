import { useRouter } from 'next/router';
import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Alert } from '@/components/ui/v3/alert';
import { TextLink } from '@/components/ui/v3/text-link';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';

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
    <div className="flex w-full flex-auto flex-col overflow-x-hidden bg-background-default">
      <div className="flex flex-col bg-background-default">
        <RetryableErrorBoundary>
          <div className="flex flex-col space-y-2">
            {hasGitRepo && (
              <Alert className="mb-4 bg-[#ebf3ff] text-center dark:bg-muted">
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="text-sm">
                      <span className="font-medium text-primary">
                        GitHub Repository Connected
                      </span>
                      <br />
                      <span className="mt-1.5 block text-gray-600 text-xs dark:text-gray-400">
                        Make sure to run{' '}
                        <code className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-primary-dark text-xs dark:text-primary">
                          nhost config pull
                        </code>{' '}
                        to sync your changes
                        <br />
                        <br />
                        If you want to connect multiple projects to the same
                        repository, you can use{' '}
                        <TextLink
                          href="https://docs.nhost.io/platform/cli/configuration-overlays"
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary text-xs hover:text-primary-dark"
                        >
                          configuration overlays
                        </TextLink>
                      </span>
                    </p>
                  </div>
                </div>
              </Alert>
            )}
          </div>
          {children}
        </RetryableErrorBoundary>
      </div>
    </div>
  );
}
