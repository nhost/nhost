/* eslint-disable no-restricted-imports */
import { DialogProvider } from '@/components/common/DialogProvider';
import { UIProvider } from '@/components/common/UIProvider';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { createTheme } from '@/components/ui/v2/createTheme';
import { mockRouter, mockSession } from '@/tests/mocks';
import { createEmotionCache } from '@/utils/createEmotionCache';
import { createHttpLink } from '@apollo/client';
import { CacheProvider } from '@emotion/react';
import { ThemeProvider } from '@mui/material/styles';
import { NhostClient, NhostProvider } from '@nhost/nextjs';
import { NhostApolloProvider } from '@nhost/react-apollo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  Queries,
  queries,
  RenderOptions,
  waitForOptions,
} from '@testing-library/react';
import {
  render as rtlRender,
  waitForElementToBeRemoved as rtlWaitForElementToBeRemoved,
} from '@testing-library/react';
import { RouterContext } from 'next/dist/shared/lib/router-context.shared-runtime';
import type { PropsWithChildren, ReactElement } from 'react';
import { Toaster } from 'react-hot-toast';

// Client-side cache, shared for the whole session of the user in the browser.
const emotionCache = createEmotionCache();

process.env = {
  TEST_MODE: 'true',
  NODE_ENV: 'development',
  NEXT_PUBLIC_NHOST_PLATFORM: 'false',
  NEXT_PUBLIC_ENV: 'dev',
  NEXT_PUBLIC_NHOST_AUTH_URL: 'https://local.auth.nhost.run/v1',
  NEXT_PUBLIC_NHOST_FUNCTIONS_URL: 'https://local.functions.nhost.run/v1',
  NEXT_PUBLIC_NHOST_GRAPHQL_URL: 'https://local.graphql.nhost.run/v1',
  NEXT_PUBLIC_NHOST_STORAGE_URL: 'https://local.storage.nhost.run/v1',
  NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL: 'https://local.hasura.nhost.run',
  NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL: 'https://local.hasura.nhost.run',
  NEXT_PUBLIC_NHOST_HASURA_API_URL: 'https://local.hasura.nhost.run',
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 0,
      cacheTime: 0,
    },
  },
});

function Providers({ children }: PropsWithChildren<{}>) {
  const nhost = new NhostClient({ subdomain: 'local' });
  const theme = createTheme('light');

  return (
    <RouterContext.Provider value={mockRouter}>
      <RetryableErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <CacheProvider value={emotionCache}>
            <NhostProvider nhost={nhost} initial={mockSession}>
              <NhostApolloProvider
                nhost={nhost}
                generateLinks={() => [
                  createHttpLink({
                    uri: 'https://local.graphql.nhost.run/v1',
                  }),
                ]}
              >
                <UIProvider>
                  <Toaster position="bottom-center" />
                  <ThemeProvider theme={theme}>
                    <DialogProvider>{children}</DialogProvider>
                  </ThemeProvider>
                </UIProvider>
              </NhostApolloProvider>
            </NhostProvider>
          </CacheProvider>
        </QueryClientProvider>
      </RetryableErrorBoundary>
    </RouterContext.Provider>
  );
}

function render<
  Q extends Queries = typeof queries,
  Container extends Element | DocumentFragment = HTMLElement,
  BaseElement extends Element | DocumentFragment = Container,
>(ui: ReactElement, options?: RenderOptions<Q, Container, BaseElement>) {
  return rtlRender<Q, Container, BaseElement>(ui, {
    wrapper: Providers,
    ...options,
  });
}

async function waitForElementToBeRemoved<T>(
  callback: T | (() => T),
  options?: waitForOptions,
): Promise<void> {
  try {
    await rtlWaitForElementToBeRemoved(callback, options);
  } catch {
    // We shouldn't fail if the element was to be removed but it wasn't there in
    // the first place.
    await Promise.resolve();
  }
}

export * from '@testing-library/react';
export { render, waitForElementToBeRemoved };
