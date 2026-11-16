import { DialogProvider } from '@/components/common/DialogProvider';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { TooltipProvider } from '@/components/ui/v3/tooltip';
import { NhostApolloProvider } from '@/providers/Apollo';
import AuthProvider from '@/providers/Auth/AuthProvider';
import { NhostProvider } from '@/providers/nhost';
import {
  ThemeColorMeta,
  ThemeDocumentClass,
  ThemePreferenceProvider,
} from '@/providers/Theme';
import '@/styles/fonts.css';
import '@/styles/globals.css';
import '@/styles/graphiql.min.css';
import '@/styles/style.css';
import { THEME_STORAGE_KEY } from '@/utils/constants/common';
import { nhost } from '@/utils/nhost';
import '@fontsource/inter';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/roboto-mono/400.css';
import '@fontsource/roboto-mono/500.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NextPage } from 'next';
import type { AppProps } from 'next/app';
import { PagesProgressBar as ProgressBar } from 'next-nprogress-bar';
import { DefaultSeo } from 'next-seo';
import type { ReactElement } from 'react';
import { Toaster } from 'react-hot-toast';

const queryClient = new QueryClient();

export type NextPageWithLayout = NextPage & {
  getLayout?: (page: ReactElement) => ReactElement;
};

export interface MyAppProps extends AppProps {
  Component: NextPageWithLayout;
}

function MyApp({ Component, pageProps }: MyAppProps) {
  const getLayout = Component.getLayout ?? ((page: ReactElement) => page);

  return (
    <QueryClientProvider client={queryClient}>
      <DefaultSeo titleTemplate="%s - Nhost" defaultTitle="Nhost" />

      <NhostProvider nhost={nhost}>
        <NhostApolloProvider
          fetchPolicy="cache-and-network"
          nhost={nhost}
          connectToDevTools={process.env.NEXT_PUBLIC_ENV === 'dev'}
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
                    <ProgressBar
                      height="2px"
                      color="#0052cd"
                      options={{ showSpinner: false }}
                    />
                    {getLayout(<Component {...pageProps} />)}
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
export default MyApp;
