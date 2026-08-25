import type { ComponentType, PropsWithChildren } from 'react';
import GraphQLPage from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/graphql/index';
import { act, render, waitFor } from '@/tests/testUtils';

interface GraphiQLInterfaceProps {
  onEditHeaders: (headers: string) => void;
}

interface WebSocketClientOptions {
  connectionParams: {
    headers: Record<string, string>;
  };
}

const mocks = vi.hoisted(() => ({
  cancelDebounce: vi.fn(),
  createClient: vi.fn((options: unknown) => options),
  createFetcher: vi.fn(() => vi.fn()),
  initialHeaders: '',
  onEditHeaders: null as GraphiQLInterfaceProps['onEditHeaders'] | null,
}));

vi.mock('@graphiql/react', async () => {
  const { Children } = await import('react');

  function GraphiQLProviderMock({ children }: PropsWithChildren) {
    // Render only the final GraphiQLEditor child; GraphiQLHeader is unrelated here.
    return Children.toArray(children).at(-1) ?? null;
  }

  return {
    DOC_EXPLORER_PLUGIN: {},
    GraphiQLProvider: GraphiQLProviderMock,
    useCopyQuery: vi.fn(),
    useEditorContext: () => ({ initialHeaders: mocks.initialHeaders }),
    useExecutionContext: vi.fn(),
    usePluginContext: vi.fn(),
    usePrettifyEditors: vi.fn(),
    useTheme: vi.fn(),
  };
});

vi.mock('@graphiql/toolkit', () => ({
  createGraphiQLFetcher: mocks.createFetcher,
}));

vi.mock('graphiql', async () => {
  const { createElement } = await import('react');

  return {
    GraphiQLInterface: ({ onEditHeaders }: GraphiQLInterfaceProps) => {
      mocks.onEditHeaders = onEditHeaders;

      return createElement('div');
    },
  };
});

vi.mock('graphql-ws', () => ({
  createClient: mocks.createClient,
}));

vi.mock('lodash.debounce', async (importOriginal) => {
  type Debounce = typeof import('lodash.debounce');

  const imported = await importOriginal<Debounce | { default: Debounce }>();
  const actual = typeof imported === 'function' ? imported : imported.default;
  const debounce: Debounce = (callback, wait, options) => {
    const debounced = actual(callback, wait, options);
    const cancel = debounced.cancel.bind(debounced);

    debounced.cancel = () => {
      mocks.cancelDebounce();
      cancel();
    };

    return debounced;
  };

  return { default: debounce };
});

vi.mock('next/dynamic', async () => {
  const { createElement, useEffect, useState } = await import('react');

  return {
    default: (loader: () => Promise<ComponentType<Record<string, never>>>) => {
      function DynamicComponent() {
        const [Component, setComponent] = useState<ComponentType<
          Record<string, never>
        > | null>(null);

        useEffect(() => {
          let isMounted = true;

          void loader().then((LoadedComponent) => {
            if (isMounted) {
              setComponent(() => LoadedComponent);
            }
          });

          return () => {
            isMounted = false;
          };
        }, []);

        return Component ? createElement(Component) : null;
      }

      return DynamicComponent;
    },
  };
});

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({
    project: {
      config: { hasura: { adminSecret: 'admin-secret' } },
      region: 'local',
      subdomain: 'local',
    },
  }),
}));

vi.mock('@/hooks/useTrackEvent', () => ({
  useTrackEvent: () => vi.fn(),
}));

function getLastConnectionHeaders() {
  const options = mocks.createClient.mock.calls.at(-1)?.[0] as
    | WebSocketClientOptions
    | undefined;

  return options?.connectionParams.headers;
}

describe('GraphQLPage persisted headers', () => {
  beforeEach(() => {
    mocks.cancelDebounce.mockClear();
    mocks.createClient.mockClear();
    mocks.createFetcher.mockClear();
    mocks.initialHeaders = '';
    mocks.onEditHeaders = null;
  });

  it('seeds valid persisted headers without an edit event', async () => {
    mocks.initialHeaders = '{"x-hasura-role":"public"}';

    render(<GraphQLPage />);

    await waitFor(() => {
      expect(getLastConnectionHeaders()).toEqual({
        'content-type': 'application/json',
        'x-hasura-admin-secret': 'admin-secret',
        'x-hasura-role': 'public',
      });
    });
  });

  it('ignores malformed persisted entries while preserving valid headers', async () => {
    mocks.initialHeaders =
      '{"x-hasura-role ":"ignored","x-invalid-value":"line one\\nline two","x-hasura-role":"public"}';

    render(<GraphQLPage />);

    await waitFor(() => {
      expect(getLastConnectionHeaders()).toEqual({
        'content-type': 'application/json',
        'x-hasura-admin-secret': 'admin-secret',
        'x-hasura-role': 'public',
      });
    });
  });

  it('clears header overrides when the Headers tab is empty', async () => {
    mocks.initialHeaders = '{"x-hasura-role":"public"}';

    render(<GraphQLPage />);

    await waitFor(() => {
      expect(getLastConnectionHeaders()).toEqual({
        'content-type': 'application/json',
        'x-hasura-admin-secret': 'admin-secret',
        'x-hasura-role': 'public',
      });
    });

    act(() => {
      mocks.onEditHeaders?.('');
    });

    await waitFor(() => {
      expect(getLastConnectionHeaders()).toEqual({
        'content-type': 'application/json',
        'x-hasura-admin-secret': 'admin-secret',
      });
    });
  });

  it('ignores invalid Headers-tab JSON', async () => {
    mocks.initialHeaders = '{"x-hasura-role":"public"}';

    render(<GraphQLPage />);

    await waitFor(() => {
      expect(getLastConnectionHeaders()).toEqual({
        'content-type': 'application/json',
        'x-hasura-admin-secret': 'admin-secret',
        'x-hasura-role': 'public',
      });
    });

    vi.useFakeTimers();
    try {
      act(() => {
        mocks.onEditHeaders?.('{invalid');
        vi.advanceTimersByTime(200);
      });

      expect(getLastConnectionHeaders()).toEqual({
        'content-type': 'application/json',
        'x-hasura-admin-secret': 'admin-secret',
        'x-hasura-role': 'public',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps user header edits debounced', async () => {
    mocks.initialHeaders = '{"x-hasura-role":"public"}';

    render(<GraphQLPage />);

    await waitFor(() => {
      expect(getLastConnectionHeaders()).toEqual({
        'content-type': 'application/json',
        'x-hasura-admin-secret': 'admin-secret',
        'x-hasura-role': 'public',
      });
    });

    act(() => {
      mocks.onEditHeaders?.('{"x-hasura-role":"editor"}');
    });

    expect(getLastConnectionHeaders()).toEqual({
      'content-type': 'application/json',
      'x-hasura-admin-secret': 'admin-secret',
      'x-hasura-role': 'public',
    });
    await waitFor(() => {
      expect(getLastConnectionHeaders()).toEqual({
        'content-type': 'application/json',
        'x-hasura-admin-secret': 'admin-secret',
        'x-hasura-role': 'editor',
      });
    });
  });

  it('cancels pending user header edits on unmount', async () => {
    const { unmount } = render(<GraphQLPage />);

    await waitFor(() => {
      expect(mocks.onEditHeaders).not.toBeNull();
    });
    expect(mocks.cancelDebounce).not.toHaveBeenCalled();

    act(() => {
      mocks.onEditHeaders?.('{"x-hasura-role":"editor"}');
    });
    expect(mocks.cancelDebounce).not.toHaveBeenCalled();

    unmount();

    expect(mocks.cancelDebounce).toHaveBeenCalledOnce();
  });
});
