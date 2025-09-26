/* eslint-disable no-restricted-imports */
/* eslint-disable max-classes-per-file */
import { DialogProvider } from '@/components/common/DialogProvider';
import { UIProvider } from '@/components/common/UIProvider';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { createTheme } from '@/components/ui/v2/createTheme';
import { AuthProvider } from '@/providers/Auth';
import { NhostProvider } from '@/providers/nhost';
import { mockRouter, mockSession } from '@/tests/mocks';
import { createEmotionCache } from '@/utils/createEmotionCache';
import { DummySessionStorage } from '@/utils/nhost';
import {
  ApolloClient,
  ApolloProvider,
  createHttpLink,
  InMemoryCache,
} from '@apollo/client';
import { CacheProvider } from '@emotion/react';
import { ThemeProvider } from '@mui/material/styles';
import { createServerClient } from '@nhost/nhost-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  Queries,
  queries,
  RenderOptions,
  waitForOptions,
} from '@testing-library/react';
import {
  fireEvent,
  render as rtlRender,
  waitForElementToBeRemoved as rtlWaitForElementToBeRemoved,
  waitFor,
} from '@testing-library/react';
import userEvent, {
  type Options,
  type UserEvent,
} from '@testing-library/user-event';
import { RouterContext } from 'next/dist/shared/lib/router-context.shared-runtime';
import type { PropsWithChildren, ReactElement } from 'react';
import { Toaster } from 'react-hot-toast';
import { vi } from 'vitest';
import nhostGraphQLLink from './msw/mocks/graphql/nhostGraphQLLink';

// Client-side cache, shared for the whole session of the user in the browser.
const emotionCache = createEmotionCache();

/* Workaround to avoid error importing type declarations for typeOptions from @testing-library/user-event */
export interface TypeOptions {
  skipClick?: Options['skipClick'];
  skipAutoClose?: Options['skipAutoClose'];
  initialSelectionStart?: number;
  initialSelectionEnd?: number;
}

process.env = {
  TEST_MODE: 'true',
  NODE_ENV: 'development',
  NEXT_PUBLIC_NHOST_PLATFORM: 'false',
  NEXT_PUBLIC_ENV: 'dev',
  NEXT_PUBLIC_NHOST_AUTH_URL: 'https://local.auth.local.nhost.run/v1',
  NEXT_PUBLIC_NHOST_FUNCTIONS_URL: 'https://local.functions.local.nhost.run/v1',
  NEXT_PUBLIC_NHOST_GRAPHQL_URL: 'https://local.graphql.local.nhost.run/v1',
  NEXT_PUBLIC_NHOST_STORAGE_URL: 'https://local.storage.local.nhost.run/v1',
  NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL: 'https://local.hasura.local.nhost.run',
  NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL:
    'https://local.hasura.local.nhost.run',
  NEXT_PUBLIC_NHOST_HASURA_API_URL: 'https://local.hasura.local.nhost.run',
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

const mockClient = new ApolloClient({
  cache: new InMemoryCache(),
  link: createHttpLink({
    uri: 'https://local.graphql.local.nhost.run/v1',
  }),
  defaultOptions: {
    query: {
      fetchPolicy: 'no-cache',
    },
    watchQuery: {
      fetchPolicy: 'no-cache',
    },
  },
});
const nhost = createServerClient({
  subdomain: 'local',
  region: 'local',
  storage: new DummySessionStorage(),
});
nhost.sessionStorage.set(mockSession);

function Providers({ children }: PropsWithChildren<{}>) {
  const theme = createTheme('light');

  return (
    <RouterContext.Provider value={mockRouter}>
      <RetryableErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <CacheProvider value={emotionCache}>
            <NhostProvider nhost={nhost}>
              <AuthProvider>
                <ApolloProvider client={mockClient}>
                  <UIProvider>
                    <Toaster position="bottom-center" />
                    <ThemeProvider theme={theme}>
                      <DialogProvider>{children}</DialogProvider>
                    </ThemeProvider>
                  </UIProvider>
                </ApolloProvider>
              </AuthProvider>
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

const graphqlRequestHandlerFactory = (
  operationName: string,
  type: 'mutation' | 'query',
  responsePromise: any,
) =>
  nhostGraphQLLink[type](operationName, async (_req, res, ctx) => {
    const data = await responsePromise;
    return res(ctx.data(data));
  });
/* Helper function to pause responses to be able to test loading states */
export const createGraphqlMockResolver = (
  operationName: string,
  type: 'mutation' | 'query',
  defaultResponse?: any,
) => {
  let resolver: (value: unknown) => void;
  const responsePromise = new Promise((resolve) => {
    resolver = resolve;
  });

  return {
    handler: graphqlRequestHandlerFactory(operationName, type, responsePromise),
    resolve: (response: any) => resolver(response ?? defaultResponse),
  };
};

export const mockPointerEvent = () => {
  // Note: Workaround based on https://github.com/radix-ui/primitives/issues/1382#issuecomment-1122069313
  class MockPointerEvent extends Event {
    button: number;

    ctrlKey: boolean;

    pointerType: string;

    constructor(type: string, props: PointerEventInit) {
      super(type, props);
      this.button = props.button || 0;
      this.ctrlKey = props.ctrlKey || false;
      this.pointerType = props.pointerType || 'mouse';
    }
  }
  window.PointerEvent = MockPointerEvent as any;
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
};

export class TestUserEvent {
  private user: UserEvent;

  constructor() {
    this.user = userEvent.setup();
  }

  async click(element: Element) {
    await waitFor(
      async () => {
        await this.user.click(element);
      },
      { timeout: 10000 },
    );
  }

  async type(element: Element, value: string, options?: TypeOptions) {
    await waitFor(async () => {
      await this.user.type(element, value, options);
    });
  }

  async keyboard(value: string) {
    await waitFor(async () => {
      await this.user.keyboard(value);
    });
  }

  async keyboardWithoutWaitFor(value: string) {
    await this.user.keyboard(value);
  }

  async clear(element: Element) {
    await waitFor(async () => {
      await this.user.clear(element);
    });
  }

  static async fireClickEvent(element: Document | Element | Window | Node) {
    await waitFor(() => {
      fireEvent(
        element,
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    });
  }

  static async fireTypeEvent(element: Element, text: string) {
    await waitFor(() => {
      fireEvent.change(element, {
        target: { value: text },
      });
      fireEvent.input(element, {
        target: { value: text },
      });
    });
  }
}

export * from '@testing-library/react';
export { render, waitForElementToBeRemoved };
