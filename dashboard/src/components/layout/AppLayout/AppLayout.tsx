import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import {
  BaseLayout,
  type BaseLayoutProps,
} from '@/components/layout/BaseLayout';
import { Header } from '@/components/layout/Header';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';

// Client-only: the sidebar restores its collapsed state from localStorage on
// first render, which the prerendered HTML cannot know, so hydrating it would
// leave the DOM out of sync with that state.
const AppSidebar = dynamic(
  () => import('@/components/layout/AppSidebar/AppSidebar'),
  { ssr: false },
);

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

  return (
    <BaseLayout className="flex h-full flex-col" {...props}>
      <Header className="shrink-0 py-1" />

      <div className="flex min-h-0 flex-1">
        <AppSidebar />

        <main className="relative flex min-w-0 flex-1 flex-col overflow-y-auto bg-accent-background">
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
