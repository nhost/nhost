import { useRouter } from 'next/router';
import { useMediaQuery } from '@/components/common/useMediaQuery';
import {
  BaseLayout,
  type BaseLayoutProps,
} from '@/components/layout/BaseLayout';
import { DashboardNavigation } from '@/components/layout/DashboardNavigation';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { Header } from '@/components/layout/Header';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';

export type AppLayoutProps = Omit<BaseLayoutProps, 'className'>;

/**
 * The dashboard shell: header across the top, app sidebar down the left, the
 * page in what remains. It owns the geometry of those three regions and knows
 * nothing about what a page renders into `<main>`.
 *
 * It must be the root element every org- and project-scoped page returns from
 * `getLayout`; React keeps the shell mounted across navigation only while the
 * root type stays the same.
 */
export default function AppLayout({ children, ...props }: AppLayoutProps) {
  const router = useRouter();
  const isDesktop = useMediaQuery('md');

  return (
    <BaseLayout className="flex h-full flex-col" {...props}>
      <Header className="shrink-0 py-1" />

      <div className="flex min-h-0 flex-1">
        {isDesktop && (
          <DashboardSidebar>
            <DashboardNavigation />
          </DashboardSidebar>
        )}

        <main className="relative min-w-0 flex-1 overflow-y-auto bg-accent-background">
          <RetryableErrorBoundary
            errorMessageProps={{ className: 'flex flex-col items-center' }}
            resetKeys={[router.asPath]}
          >
            {children}
          </RetryableErrorBoundary>
        </main>
      </div>
    </BaseLayout>
  );
}
