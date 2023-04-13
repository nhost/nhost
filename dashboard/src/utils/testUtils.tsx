/* eslint-disable no-restricted-imports */
import { DialogProvider } from '@/components/common/DialogProvider';
import RetryableErrorBoundary from '@/components/common/RetryableErrorBoundary';
import { ManagedUIContext } from '@/context/UIContext';
import createTheme from '@/ui/v2/createTheme';
import { createHttpLink } from '@apollo/client';
import { CacheProvider } from '@emotion/react';
import { faker } from '@faker-js/faker';
import { ThemeProvider } from '@mui/material/styles';
import type { NhostSession } from '@nhost/nextjs';
import { NhostClient, NhostProvider } from '@nhost/nextjs';
import { NhostApolloProvider } from '@nhost/react-apollo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Queries, RenderOptions, queries } from '@testing-library/react';
import { render as rtlRender } from '@testing-library/react';
import { RouterContext } from 'next/dist/shared/lib/router-context';
import type { NextRouter } from 'next/router';
import type { PropsWithChildren, ReactElement } from 'react';
import { Toaster } from 'react-hot-toast';
import { vi } from 'vitest';
import createEmotionCache from './createEmotionCache';

// Client-side cache, shared for the whole session of the user in the browser.
const emotionCache = createEmotionCache();

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

export const mockRouter: NextRouter = {
  basePath: '',
  pathname: '/',
  route: '/',
  asPath: '/',
  isLocaleDomain: false,
  isReady: true,
  isPreview: false,
  query: {},
  push: vi.fn(),
  replace: vi.fn(),
  reload: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
  beforePopState: vi.fn(),
  events: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
  isFallback: false,
};

export const mockSession: NhostSession = {
  accessToken: faker.random.alphaNumeric(),
  accessTokenExpiresIn: 900,
  refreshToken: faker.datatype.uuid(),
  user: {
    id: faker.datatype.uuid(),
    email: faker.internet.email(),
    displayName: faker.name.fullName(),
    createdAt: faker.date.past().toISOString(),
    avatarUrl: faker.image.avatar(),
    locale: 'en',
    isAnonymous: false,
    defaultRole: 'user',
    roles: ['user', 'me'],
    metadata: {},
    emailVerified: true,
    phoneNumber: faker.phone.number(),
    phoneNumberVerified: true,
    activeMfaType: 'totp',
  },
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
                <ManagedUIContext>
                  <Toaster position="bottom-center" />
                  <ThemeProvider theme={theme}>
                    <DialogProvider>{children}</DialogProvider>
                  </ThemeProvider>
                </ManagedUIContext>
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
  return rtlRender(ui, { wrapper: Providers, ...options });
}

export * from '@testing-library/react';
export { render };
