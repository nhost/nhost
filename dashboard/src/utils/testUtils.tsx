/* eslint-disable no-restricted-imports */
import DialogProvider from '@/components/common/DialogProvider/DialogProvider';
import RetryableErrorBoundary from '@/components/common/RetryableErrorBoundary';
import { ManagedUIContext } from '@/context/UIContext';
import { WorkspaceProvider } from '@/context/workspace-context';
import { UserDataProvider } from '@/context/workspace1-context';
import type { Project } from '@/types/application';
import { ApplicationStatus } from '@/types/application';
import type { Workspace } from '@/types/workspace';
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
import type { NextRouter } from 'next/router';
import type { PropsWithChildren, ReactElement } from 'react';
import { Toaster } from 'react-hot-toast';
import { vi } from 'vitest';
import createEmotionCache from './createEmotionCache';
import { nhost } from './nhost';

// Client-side cache, shared for the whole session of the user in the browser.
const emotionCache = createEmotionCache();
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

export const mockRouter: NextRouter = {
  basePath: '',
  pathname: '/test-workspace/test-application',
  route: '/[workspaceSlug]/[appSlug]',
  asPath: '/test-workspace/test-application',
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

export const mockApplication: Project = {
  id: '1',
  name: 'Test Application',
  slug: 'test-application',
  appStates: [],
  subdomain: '',
  isProvisioned: true,
  region: {
    awsName: 'us-east-1',
    city: 'New York',
    countryCode: 'US',
    id: '1',
  },
  createdAt: new Date().toISOString(),
  deployments: [],
  desiredState: ApplicationStatus.Live,
  featureFlags: [],
  providersUpdated: true,
  githubRepository: { fullName: 'test/git-project' },
  repositoryProductionBranch: null,
  nhostBaseFolder: null,
  plan: {
    id: '1',
    name: 'Starter',
    isFree: true,
    price: 0,
  },
  config: {
    hasura: {
      adminSecret: 'nhost-admin-secret',
    },
  },
};

export const mockWorkspace: Workspace = {
  id: '1',
  name: 'Test Workspace',
  slug: 'test-workspace',
  members: [],
  applications: [mockApplication],
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
                  uri: 'http://localhost:1337/v1/graphql',
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
  return rtlRender(ui, { wrapper: Providers, ...options });
}

export * from '@testing-library/react';
export { render };
