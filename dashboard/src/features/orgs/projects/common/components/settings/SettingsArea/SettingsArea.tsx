import { useRouter } from 'next/router';
import type { ReactNode } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { cn } from '@/lib/utils';

/**
 * The column a project settings page renders into: one width, with the page
 * title on top and the GitHub sync reminder below it while a repository is
 * connected. A page
 * that throws is replaced within this column, so the organization status and
 * the guards above stay mounted.
 */
interface SettingsAreaProps {
  children: ReactNode;
  /** The page title, usually the label of the active settings navigation link. */
  title?: string;
  className?: string;
}

export default function SettingsArea({
  children,
  className,
}: SettingsAreaProps) {
  const router = useRouter();

  return (
    <div className={cn('mx-auto w-full max-w-5xl px-5 py-8', className)}>
      <RetryableErrorBoundary resetKeys={[router.asPath]}>
        {children}
      </RetryableErrorBoundary>
    </div>
  );
}
