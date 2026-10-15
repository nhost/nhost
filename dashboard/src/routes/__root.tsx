import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, Outlet, redirect } from '@tanstack/react-router';
import { Toaster } from 'react-hot-toast';
import { DialogProvider } from '@/components/common/DialogProvider';
import { NotFoundPage } from '@/components/presentational/NotFoundPage';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { TooltipProvider } from '@/components/ui/v3/tooltip';
import { getSearchParam } from '@/lib/search-params';
import { NhostApolloProvider } from '@/providers/Apollo';
import AuthProvider from '@/providers/Auth/AuthProvider';
import { NhostProvider } from '@/providers/nhost';
import {
  ThemeColorMeta,
  ThemeDocumentClass,
  ThemePreferenceProvider,
} from '@/providers/Theme';
import { getLegacyRedirect } from '@/routes/-legacyRedirects';
import { THEME_STORAGE_KEY } from '@/utils/constants/common';
import { nhost } from '@/utils/nhost';

// Client-side cache, shared for the whole session of the user in the browser.
const queryClient = new QueryClient();

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <NhostProvider nhost={nhost}>
        <NhostApolloProvider
          fetchPolicy="cache-and-network"
          nhost={nhost}
          connectToDevTools={import.meta.env.NEXT_PUBLIC_ENV === 'dev'}
        >
          <AuthProvider>
            {/* z-index above the z-[9999] dialogs and z-[10000] popovers */}
            <Toaster
              position="bottom-center"
              containerStyle={{ zIndex: 10001 }}
            />
            <ThemePreferenceProvider storageKey={THEME_STORAGE_KEY}>
              <ThemeDocumentClass />
              <ThemeColorMeta />
              <RetryableErrorBoundary>
                <TooltipProvider>
                  <DialogProvider>
                    <Outlet />
                  </DialogProvider>
                </TooltipProvider>
              </RetryableErrorBoundary>
            </ThemePreferenceProvider>
          </AuthProvider>
        </NhostApolloProvider>
      </NhostProvider>
    </QueryClientProvider>
  );
}

export const Route = createRootRoute({
  // Stripe returns to the page that started a checkout with `session_id`;
  // the dialogs finishing it are mounted on many pages.
  validateSearch: (search): { session_id?: string } => ({
    session_id: getSearchParam(search.session_id),
  }),
  beforeLoad: ({ location }) => {
    const legacyRedirect = getLegacyRedirect(
      location.pathname,
      location.searchStr,
    );

    if (legacyRedirect) {
      throw redirect({ href: legacyRedirect, replace: true });
    }
  },
  component: RootComponent,
  notFoundComponent: NotFoundPage,
});
