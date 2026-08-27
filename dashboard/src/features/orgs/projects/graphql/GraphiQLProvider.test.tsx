import {
  type EditorContextType,
  GraphiQLProvider,
  useEditorContext,
  useStorageContext,
} from '@graphiql/react';
import { useCallback, useLayoutEffect, useReducer, useRef } from 'react';
import { useGraphiQLHeaderSync } from '@/features/orgs/projects/graphql/GraphiQLEditor/GraphiQLEditor';
import useGraphQLPlaygroundHeaders from '@/features/orgs/projects/graphql/hooks/useGraphQLPlaygroundHeaders/useGraphQLPlaygroundHeaders';
import { act, render, screen, waitFor } from '@/tests/testUtils';

const UPSTREAM_HEADERS_STORAGE_KEY = 'graphiql:headers';
const UPSTREAM_QUERY_STORAGE_KEY = 'graphiql:query';
const UPSTREAM_TABS_STORAGE_KEY = 'graphiql:tabState';
const DASHBOARD_HEADERS_STORAGE_KEY = 'nhost_graphql_playground_headers:local';
const PERSISTED_HEADERS = '{"x-hasura-role":"public"}';
const UNSAVED_HEADERS = '{"x-hasura-role":"editor"}';
const FIRST_QUERY = 'query First { first }';
const SECOND_QUERY = 'query Second { second }';
const persistedEdits = vi.fn();

function InitialHeadersProbe() {
  const { initialHeaders } = useEditorContext({ nonNull: true });

  return <output data-testid="initial-headers">{initialHeaders}</output>;
}

interface ProviderHeaderEditorContractProps {
  headerClearVersion: number;
  headerText: string;
  onEditHeaders: (headers: string) => void;
}

type HeaderEditorContract = Parameters<EditorContextType['setHeaderEditor']>[0];

function ProviderHeaderEditorContract({
  headerClearVersion,
  headerText,
  onEditHeaders,
}: ProviderHeaderEditorContractProps) {
  const context = useEditorContext({ nonNull: true });
  const handleEditorHeaderChange = useGraphiQLHeaderSync({
    headerClearVersion,
    headerText,
    onEditHeaders,
  });
  const handleEditorHeaderChangeRef = useRef(handleEditorHeaderChange);
  const editorRef = useRef<HeaderEditorContract | null>(null);
  const [, forceEditorRender] = useReducer((version: number) => version + 1, 0);
  handleEditorHeaderChangeRef.current = handleEditorHeaderChange;

  if (!editorRef.current) {
    let value = context.initialHeaders;
    editorRef.current = {
      getValue: () => value,
      setValue: (nextValue: string) => {
        value = nextValue;
        handleEditorHeaderChangeRef.current(nextValue);
        forceEditorRender();
      },
    } as HeaderEditorContract;
  }

  useLayoutEffect(() => {
    if (editorRef.current) {
      context.setHeaderEditor(editorRef.current);
    }
  }, [context.setHeaderEditor]);

  return (
    <>
      <button
        type="button"
        onClick={() => context.changeTab(context.activeTabIndex === 0 ? 1 : 0)}
      >
        Change tabs
      </button>
      <button
        type="button"
        onClick={() => editorRef.current?.setValue(UNSAVED_HEADERS)}
      >
        Edit headers
      </button>
      <output data-testid="active-header-value">
        {`${context.activeTabIndex}:${context.headerEditor?.getValue() ?? 'not-ready'}`}
      </output>
    </>
  );
}

function ClearStorageButton() {
  const storage = useStorageContext({ nonNull: true });

  return (
    <button type="button" onClick={() => storage.clear()}>
      Clear data
    </button>
  );
}

function PersistedHeadersHarness() {
  const { headerClearVersion, headerText, setHeaderText, storage } =
    useGraphQLPlaygroundHeaders('local');
  const handleEditHeaders = useCallback(
    (nextHeaderText: string) => {
      persistedEdits(nextHeaderText);
      setHeaderText(nextHeaderText);
    },
    [setHeaderText],
  );

  return (
    <GraphiQLProvider
      defaultHeaders={headerText}
      fetcher={vi.fn()}
      headers={headerText}
      schema={null}
      shouldPersistHeaders={false}
      storage={storage}
    >
      <ClearStorageButton />
      <ProviderHeaderEditorContract
        headerClearVersion={headerClearVersion}
        headerText={headerText}
        onEditHeaders={handleEditHeaders}
      />
    </GraphiQLProvider>
  );
}

function createStoredTab(id: string, title: string, query: string) {
  return {
    headers: null,
    id,
    operationName: title,
    query,
    response: null,
    title,
    variables: null,
  };
}

function storeTwoTabsWithoutHeaders() {
  localStorage.setItem(UPSTREAM_QUERY_STORAGE_KEY, FIRST_QUERY);
  localStorage.setItem(
    UPSTREAM_TABS_STORAGE_KEY,
    JSON.stringify({
      activeTabIndex: 0,
      tabs: [
        createStoredTab('first-tab', 'First', FIRST_QUERY),
        createStoredTab('second-tab', 'Second', SECOND_QUERY),
      ],
    }),
  );
}

async function verifyPersistedHeadersSurviveTabChange() {
  const { unmount } = render(<PersistedHeadersHarness />);
  const possibleHeaderValues = [
    `0:${PERSISTED_HEADERS}`,
    `1:${PERSISTED_HEADERS}`,
  ];

  await waitFor(() => {
    expect(possibleHeaderValues).toContain(
      screen.getByTestId('active-header-value').textContent,
    );
  });

  const activeTabIndex = Number(
    screen.getByTestId('active-header-value').textContent?.at(0),
  );
  const nextTabIndex = activeTabIndex === 0 ? 1 : 0;
  persistedEdits.mockClear();
  act(() => {
    screen.getByRole('button', { name: 'Change tabs' }).click();
  });

  await waitFor(() => {
    expect(screen.getByTestId('active-header-value').textContent).toBe(
      `${nextTabIndex}:${PERSISTED_HEADERS}`,
    );
    expect(persistedEdits).toHaveBeenCalledWith(PERSISTED_HEADERS);
  });
  expect(persistedEdits).not.toHaveBeenCalledWith('');
  expect(localStorage.getItem(DASHBOARD_HEADERS_STORAGE_KEY)).toBe(
    JSON.stringify(PERSISTED_HEADERS),
  );

  unmount();
}

describe('GraphiQLProvider controlled headers contract', () => {
  beforeEach(() => {
    persistedEdits.mockClear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('uses the controlled headers instead of upstream storage', () => {
    localStorage.setItem(UPSTREAM_HEADERS_STORAGE_KEY, '{"stale":true}');

    render(
      <GraphiQLProvider
        fetcher={vi.fn()}
        headers={PERSISTED_HEADERS}
        schema={null}
        shouldPersistHeaders={false}
      >
        <InitialHeadersProbe />
      </GraphiQLProvider>,
    );

    expect(screen.getByTestId('initial-headers').textContent).toBe(
      PERSISTED_HEADERS,
    );
  });

  it('keeps an empty controlled state empty when upstream storage is stale', () => {
    localStorage.setItem(UPSTREAM_HEADERS_STORAGE_KEY, PERSISTED_HEADERS);

    render(
      <GraphiQLProvider
        fetcher={vi.fn()}
        headers=""
        schema={null}
        shouldPersistHeaders={false}
      >
        <InitialHeadersProbe />
      </GraphiQLProvider>,
    );

    expect(screen.getByTestId('initial-headers').textContent).toBe('');
  });

  it('passes controlled initial headers to HTTP introspection across mounts', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: {} });
    const renderProvider = () =>
      render(
        <GraphiQLProvider
          fetcher={fetcher}
          headers={PERSISTED_HEADERS}
          shouldPersistHeaders={false}
        >
          <InitialHeadersProbe />
        </GraphiQLProvider>,
      );

    const { unmount } = renderProvider();

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(
        expect.objectContaining({ operationName: 'IntrospectionQuery' }),
        { headers: { 'x-hasura-role': 'public' } },
      );
    });

    unmount();
    fetcher.mockClear();
    renderProvider();

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(
        expect.objectContaining({ operationName: 'IntrospectionQuery' }),
        { headers: { 'x-hasura-role': 'public' } },
      );
    });
  });

  it('restores dashboard headers after the real provider emits a tab-driven editor reset', async () => {
    localStorage.setItem(
      DASHBOARD_HEADERS_STORAGE_KEY,
      JSON.stringify(PERSISTED_HEADERS),
    );
    storeTwoTabsWithoutHeaders();

    await verifyPersistedHeadersSurviveTabChange();
    await verifyPersistedHeadersSurviveTabChange();
  });

  it('cancels an unsaved edit when clearing an already-empty controlled state', async () => {
    vi.useFakeTimers();

    try {
      render(<PersistedHeadersHarness />);

      act(() => {
        screen.getByRole('button', { name: 'Edit headers' }).click();
      });
      expect(screen.getByTestId('active-header-value').textContent).toBe(
        `0:${UNSAVED_HEADERS}`,
      );
      expect(localStorage.getItem(DASHBOARD_HEADERS_STORAGE_KEY)).toBeNull();

      await act(async () => {
        await Promise.resolve();
      });
      expect(persistedEdits).not.toHaveBeenCalled();

      act(() => {
        screen.getByRole('button', { name: 'Clear data' }).click();
      });
      expect(screen.getByTestId('active-header-value').textContent).toBe('0:');

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(persistedEdits).not.toHaveBeenCalled();
      expect(localStorage.getItem(DASHBOARD_HEADERS_STORAGE_KEY)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears persisted and controlled headers through the real provider storage boundary', async () => {
    localStorage.setItem(
      DASHBOARD_HEADERS_STORAGE_KEY,
      JSON.stringify(PERSISTED_HEADERS),
    );
    localStorage.setItem(UPSTREAM_QUERY_STORAGE_KEY, FIRST_QUERY);

    const { unmount } = render(<PersistedHeadersHarness />);

    await waitFor(() => {
      expect(screen.getByTestId('active-header-value').textContent).toBe(
        `0:${PERSISTED_HEADERS}`,
      );
    });

    act(() => {
      screen.getByRole('button', { name: 'Clear data' }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('active-header-value').textContent).toBe('0:');
      expect(localStorage.getItem(DASHBOARD_HEADERS_STORAGE_KEY)).toBeNull();
    });
    expect(localStorage.getItem(UPSTREAM_QUERY_STORAGE_KEY)).toBeNull();

    unmount();
    render(<PersistedHeadersHarness />);

    await waitFor(() => {
      expect(screen.getByTestId('active-header-value').textContent).toMatch(
        /^\d+:$/,
      );
    });
    expect(localStorage.getItem(DASHBOARD_HEADERS_STORAGE_KEY)).toBeNull();
  });
});
