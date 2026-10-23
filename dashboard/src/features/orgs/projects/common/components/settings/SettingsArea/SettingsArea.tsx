import { useRouter } from 'next/router';
import type { ReactNode } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { GitHubConnectedNotice } from '@/features/orgs/projects/common/components/settings/GitHubConnectedNotice';
import { cn } from '@/lib/utils';

/**
 * The column a project settings page renders into: one width, with the
 * GitHub sync reminder above the page while a repository is connected. A page
 * that throws is replaced within this column, so the organization status and
 * the guards above stay mounted.
 */
interface SettingsAreaProps {
  children: ReactNode;
  className?: string;
}

export default function SettingsArea({
  children,
  className,
}: SettingsAreaProps) {
  const router = useRouter();

  return (
    <div className={cn('mx-auto w-full max-w-5xl px-5 py-8', className)}>
      <div className="grid grid-flow-row gap-6">
        <GitHubConnectedNotice />
        <RetryableErrorBoundary resetKeys={[router.asPath]}>
          {children}
        </RetryableErrorBoundary>
      </div>
    </div>
  );
}
