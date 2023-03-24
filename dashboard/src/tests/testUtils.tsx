/* eslint-disable no-restricted-imports */
import DialogProvider from '@/components/common/DialogProvider';
import RetryableErrorBoundary from '@/components/common/RetryableErrorBoundary';
import { ManagedUIContext } from '@/context/UIContext';
import { WorkspaceProvider } from '@/context/workspace-context';
import { UserDataProvider } from '@/context/workspace1-context';
import { mockRouter, mockWorkspace } from '@/tests/mocks';
import createTheme from '@/ui/v2/createTheme';
import { createHttpLink } from '@apollo/client';
import { CacheProvider } from '@emotion/react';
import { ThemeProvider } from '@mui/material/styles';
import { NhostProvider } from '@nhost/nextjs';
import { NhostApolloProvider } from '@nhost/react-apollo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { queries, Queries, RenderOptions } from '@testing-library/react';
import { render as rtlRender } from '@testing-library/react';
import { RouterContext } from 'next/dist/shared/lib/router-context';
import type { PropsWithChildren, ReactElement } from 'react';
import { Toaster } from 'react-hot-toast';
import createEmotionCache from '../utils/createEmotionCache';
import { nhost } from '../utils/nhost';

// Client-side cache, shared for the whole session of the user in the browser.
const emotionCache = createEmotionCache();
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

process.env = {
  NODE_ENV: 'development',
  NEXT_PUBLIC_NHOST_PLATFORM: 'false',
  NEXT_PUBLIC_ENV: 'dev',
  NEXT_PUBLIC_NHOST_AUTH_URL: 'https://localdev.nhost.run/v1/auth',
  NEXT_PUBLIC_NHOST_FUNCTIONS_URL: 'https://localdev.nhost.run/v1/functions',
  NEXT_PUBLIC_NHOST_GRAPHQL_URL: 'https://localdev.nhost.run/v1/graphql',
  NEXT_PUBLIC_NHOST_STORAGE_URL: 'https://localdev.nhost.run/v1/storage',
  NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL: 'http://localhost:9695',
  NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL: 'http://localhost:9693',
  NEXT_PUBLIC_NHOST_HASURA_API_URL: 'http://localhost:8080',
};

function Providers({ children }: PropsWithChildren<{}>) {
  const theme = createTheme('light');

  return (
    <RouterContext.Provider value={mockRouter}>
      <RetryableErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <CacheProvider value={emotionCache}>
            <NhostProvider nhost={nhost}>
              <NhostApolloProvider
                nhost={nhost}
                link={createHttpLink({
                  uri: 'https://local.graphql.nhost.run/v1',
                })}
              >
                <WorkspaceProvider>
                  <UserDataProvider initialWorkspaces={[mockWorkspace]}>
                    <ManagedUIContext>
                      <Toaster position="bottom-center" />
                      <ThemeProvider theme={theme}>
                        <DialogProvider>{children}</DialogProvider>
                      </ThemeProvider>
                    </ManagedUIContext>
                  </UserDataProvider>
                </WorkspaceProvider>
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

export * from '@testing-library/react';
export { render };
