import { DialogProvider } from '@/components/common/DialogProvider';
import { UIProvider } from '@/components/common/UIProvider';
import { TreeNavStateProvider } from '@/components/layout/MainNav/TreeNavStateContext';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ThemeProvider } from '@/components/ui/v2/ThemeProvider';
import { TooltipProvider } from '@/components/ui/v3/tooltip';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
// eslint-disable-next-line import/extensions
import '@/styles/fonts.css';
// eslint-disable-next-line import/extensions
import '@/styles/github-dark.css';
// eslint-disable-next-line import/extensions
import '@/styles/globals.css';
// eslint-disable-next-line import/extensions
import '@/styles/graphiql.min.css';
// eslint-disable-next-line import/extensions
import '@/styles/style.css';
import { COLOR_PREFERENCE_STORAGE_KEY } from '@/utils/constants/common';
import { createEmotionCache } from '@/utils/createEmotionCache';
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
import { PagesProgressBar as ProgressBar } from 'next-nprogress-bar';
import { DefaultSeo } from 'next-seo';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import Script from 'next/script';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { RecoilRoot } from 'recoil';

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
    <QueryClientProvider client={queryClient}>
      <DefaultSeo titleTemplate="%s - Nhost" defaultTitle="Nhost" />

      <CacheProvider value={emotionCache}>
        <NhostProvider nhost={nhost}>
          <NhostApolloProvider
            fetchPolicy="cache-and-network"
            nhost={nhost}
            connectToDevTools={process.env.NEXT_PUBLIC_ENV === 'dev'}
          >
            <UIProvider>
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
                <RetryableErrorBoundary>
                  <RecoilRoot>
                    <TooltipProvider>
                      <DialogProvider>
                        <ProgressBar
                          height="2px"
                          color="#0052cd"
                          options={{ showSpinner: false }}
                        />
                        <TreeNavStateProvider>
                          {getLayout(<Component {...pageProps} />)}
                        </TreeNavStateProvider>
                      </DialogProvider>
                    </TooltipProvider>
                  </RecoilRoot>
                </RetryableErrorBoundary>
              </ThemeProvider>
            </UIProvider>
          </NhostApolloProvider>
        </NhostProvider>
      </CacheProvider>
    </QueryClientProvider>
  );
}
export default MyApp;
