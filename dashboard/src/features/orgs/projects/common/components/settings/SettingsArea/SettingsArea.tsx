import { useRouter } from 'next/router';
import type { PropsWithChildren } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { GitHubConnectedNotice } from '@/features/orgs/projects/common/components/settings/GitHubConnectedNotice';

/**
 * The column a project settings page renders into: one width, with the
 * GitHub sync reminder above the page while a repository is connected. A page
 * that throws is replaced within this column, so the organization status and
 * the guards above stay mounted.
 */
export default function SettingsArea({ children }: PropsWithChildren) {
  const router = useRouter();

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-6">
      <div className="grid grid-flow-row gap-6">
        <GitHubConnectedNotice />
        <RetryableErrorBoundary resetKeys={[router.asPath]}>
          {children}
        </RetryableErrorBoundary>
      </div>
    </div>
  );
}
