import { useRouter } from 'next/router';
import {
  BaseLayout,
  type BaseLayoutProps,
} from '@/components/layout/BaseLayout';
import { Header } from '@/components/layout/Header';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import {
  CommandPaletteProvider,
  NavigationSearch,
} from '@/features/command-palette/CommandPaletteProvider';

export type StandaloneLayoutProps = Omit<BaseLayoutProps, 'className'>;

/**
 * Header across the top, the page below. For pages outside an organization —
 * onboarding, support, account — where the app sidebar has nothing to show.
 */
export default function StandaloneLayout({
  children,
  ...props
}: StandaloneLayoutProps) {
  const router = useRouter();

  return (
    <BaseLayout className="flex h-full flex-col" {...props}>
      <CommandPaletteProvider>
        <Header className="shrink-0 py-1" />

        <div className="w-52 p-2">
          <NavigationSearch />
        </div>

        <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
          <RetryableErrorBoundary
            errorMessageProps={{ className: 'flex flex-col items-center' }}
            resetKeys={[router.asPath]}
          >
            {children}
          </RetryableErrorBoundary>
        </main>
      </CommandPaletteProvider>
    </BaseLayout>
  );
}
