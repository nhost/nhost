import DialogProvider from '@/components/common/DialogProvider/DialogProvider';
import ErrorBoundaryFallback from '@/components/common/ErrorBoundaryFallback';
import { ManagedUIContext } from '@/context/UIContext';
import { WorkspaceProvider } from '@/context/workspace-context';
import { UserDataProvider } from '@/context/workspace1-context';
import useIsPlatform from '@/hooks/common/useIsPlatform';
import '@/styles/fonts.css';
import '@/styles/globals.css';
import '@/styles/graphiql.min.css';
import '@/styles/style.css';
import ThemeProvider from '@/ui/v2/ThemeProvider';
import { COLOR_PREFERENCE_STORAGE_KEY } from '@/utils/CONSTANTS';
import createEmotionCache from '@/utils/createEmotionCache';
import { nhost } from '@/utils/nhost';
import type { EmotionCache } from '@emotion/react';
import { CacheProvider } from '@emotion/react';
import '@fontsource/inter';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/roboto-mono/400.css';
import '@fontsource/roboto-mono/500.css';
import { NhostProvider } from '@nhost/nextjs';
import { NhostApolloProvider } from '@nhost/react-apollo';
import * as snippet from '@segment/snippet';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NextPage } from 'next';
import { DefaultSeo } from 'next-seo';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import Script from 'next/script';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Toaster } from 'react-hot-toast';

// Client-side cache, shared for the whole session of the user in the browser.
const clientSideEmotionCache = createEmotionCache();
const queryClient = new QueryClient();

export type NextPageWithLayout = NextPage & {
  getLayout?: (page: ReactElement) => ReactElement;
};

export interface MyAppProps extends AppProps {
  emotionCache?: EmotionCache;
  Component: NextPageWithLayout;
}

function MyApp({
  Component,
  pageProps,
  emotionCache = clientSideEmotionCache,
}: MyAppProps) {
  const isPlatform = useIsPlatform();
  const router = useRouter();

  // segment snippet
  function renderSnippet() {
    const opts = {
      apiKey: process.env.NEXT_PUBLIC_ANALYTICS_WRITE_KEY,
      page: true,
    };

    if (process.env.NODE_ENV === 'development') {
      return snippet.max(opts);
    }

    return snippet.min(opts);
  }

  useEffect(() => {
    // track page changes
    const handleRouteChange = () => {
      global.analytics?.page();
    };
    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  const getLayout = Component.getLayout ?? ((page: ReactElement) => page);

  return (
    <ErrorBoundary fallbackRender={ErrorBoundaryFallback}>
      <DefaultSeo titleTemplate="%s - Nhost" defaultTitle="Nhost" />

      <QueryClientProvider client={queryClient}>
        <CacheProvider value={emotionCache}>
          <NhostProvider nhost={nhost}>
            <NhostApolloProvider
              fetchPolicy="cache-first"
              nhost={nhost}
              connectToDevTools={process.env.NEXT_PUBLIC_ENV === 'dev'}
            >
              <WorkspaceProvider>
                <UserDataProvider>
                  <ManagedUIContext>
                    <Toaster position="bottom-center" />

                    {isPlatform && (
                      <Script
                        id="segment"
                        dangerouslySetInnerHTML={{ __html: renderSnippet() }}
                      />
                    )}

                    <ThemeProvider
                      colorPreferenceStorageKey={COLOR_PREFERENCE_STORAGE_KEY}
                    >
                      <DialogProvider>
                        {getLayout(<Component {...pageProps} />)}
                      </DialogProvider>
                    </ThemeProvider>
                  </ManagedUIContext>
                </UserDataProvider>
              </WorkspaceProvider>
            </NhostApolloProvider>
          </NhostProvider>
        </CacheProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
export default MyApp;
