import { useMediaQuery } from '@/components/common/useMediaQuery';
import {
  BaseLayout,
  type BaseLayoutProps,
} from '@/components/layout/BaseLayout';
import { DashboardNavigation } from '@/components/layout/DashboardNavigation';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { Header } from '@/components/layout/Header';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { useCurrentHref } from '@/lib/route-navigation';

type AppLayoutProps = Omit<BaseLayoutProps, 'className'>;

/**
 * The dashboard shell: header across the top, app sidebar down the left, the
 * page in what remains. It owns the geometry of those three regions and knows
 * nothing about what a page renders into `<main>`. `<main>` does not scroll:
 * the scope or layout inside it decides which region does.
 *
 * The `/orgs/$orgSlug` layout route renders it, so it stays mounted while the
 * user moves between organization and project pages.
 */
export default function AppLayout({ children, ...props }: AppLayoutProps) {
  const currentHref = useCurrentHref();
  // Matches the header, which also renders the desktop layout until the
  // viewport is known.
  const isDesktop = useMediaQuery('md', { initialValue: true });

  return (
    <BaseLayout className="flex h-full flex-col" {...props}>
      <Header className="shrink-0 py-1" />

      <div className="flex min-h-0 flex-1">
        {isDesktop && (
          <DashboardSidebar>
            <DashboardNavigation />
          </DashboardSidebar>
        )}

        <main className="relative flex min-w-0 flex-1 flex-col bg-background">
          <RetryableErrorBoundary
            errorMessageProps={{ className: 'flex flex-col items-center' }}
            resetKeys={[currentHref]}
          >
            {children}
          </RetryableErrorBoundary>
        </main>
      </div>
    </BaseLayout>
  );
}
