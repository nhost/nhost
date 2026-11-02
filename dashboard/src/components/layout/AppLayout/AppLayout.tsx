import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useMediaQuery } from '@/components/common/useMediaQuery';
import {
  BaseLayout,
  type BaseLayoutProps,
} from '@/components/layout/BaseLayout';
import { DashboardNavigation } from '@/components/layout/DashboardNavigation';
import { Header } from '@/components/layout/Header';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';

// Client-only: the sidebar restores its collapsed state from localStorage on
// first render, which the prerendered HTML cannot know, so hydrating it would
// leave the DOM out of sync with that state.
const DashboardSidebar = dynamic(
  () =>
    import('@/components/layout/DashboardSidebar').then(
      (mod) => mod.DashboardSidebar,
    ),
  { ssr: false },
);

// Client-only too: the person's project colors live in localStorage.
const ProjectColorBar = dynamic(
  () => import('@/features/project-colors').then((mod) => mod.ProjectColorBar),
  { ssr: false },
);

type AppLayoutProps = Omit<BaseLayoutProps, 'className'>;

/**
 * The dashboard shell: header across the top, app sidebar down the left, the
 * page in what remains. It owns the geometry of those three regions and knows
 * nothing about what a page renders into `<main>`. `<main>` does not scroll:
 * the scope or layout inside it decides which region does.
 *
 * It must be the root element every org- and project-scoped page returns from
 * `getLayout`; React keeps the shell mounted across navigation only while the
 * root type stays the same.
 */
export default function AppLayout({ children, ...props }: AppLayoutProps) {
  const router = useRouter();
  // Matches the header, which also renders the desktop layout until the
  // viewport is known.
  const isDesktop = useMediaQuery('md', { initialValue: true });

  return (
    <BaseLayout className="flex h-full flex-col" {...props}>
      <ProjectColorBar />
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
            resetKeys={[router.asPath]}
          >
            {children}
          </RetryableErrorBoundary>
        </main>
      </div>
    </BaseLayout>
  );
}
