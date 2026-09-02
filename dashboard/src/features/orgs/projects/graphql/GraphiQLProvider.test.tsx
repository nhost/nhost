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
const STALE_COMMITTED_HEADERS = '{"x-hasura-role":"edito"}';
const UNSAVED_HEADERS = '{"x-hasura-role":"editor"}';
const EXTERNAL_HEADERS = '{"x-hasura-role":"external"}';
const FIRST_QUERY = 'query First { first }';
const SECOND_QUERY = 'query Second { second }';
const persistedEdits = vi.fn();
const programmaticHeaderEdits = vi.fn();

function InitialHeadersProbe() {
  const { initialHeaders } = useEditorContext({ nonNull: true });

  return <output data-testid="initial-headers">{initialHeaders}</output>;
}

interface ProviderHeaderEditorContractProps {
  headerClearVersion: number;
  headerText: string;
  nextHeaderTextAfterCommit?: string;
  onEditHeaders: (headers: string) => void;
  userEditText?: string;
}

type HeaderEditorContract = Parameters<EditorContextType['setHeaderEditor']>[0];

function ProviderHeaderEditorContract({
  headerClearVersion,
  headerText,
  nextHeaderTextAfterCommit,
  onEditHeaders,
  userEditText = UNSAVED_HEADERS,
}: ProviderHeaderEditorContractProps) {
  const context = useEditorContext({ nonNull: true });
  const handleEditorHeaderChange = useGraphiQLHeaderSync({
    headerClearVersion,
    headerText,
    onEditHeaders,
  });
  const handleEditorHeaderChangeRef = useRef(handleEditorHeaderChange);
  const applyUserHeaderChangeRef = useRef<(nextValue: string) => void>(
    () => {},
  );
  const editorRef = useRef<HeaderEditorContract | null>(null);
  const previousHeaderText = useRef(headerText);
  const [, forceEditorRender] = useReducer((version: number) => version + 1, 0);
  handleEditorHeaderChangeRef.current = handleEditorHeaderChange;

  const createHeaderEditor = (initialValue: string) => {
    let value = initialValue;
    const applyHeaderChange = (nextValue: string) => {
      value = nextValue;
      handleEditorHeaderChangeRef.current(nextValue);
      forceEditorRender();
    };
    const editor = {
      getValue: () => value,
      setValue: (nextValue: string) => {
        programmaticHeaderEdits(nextValue);
        applyHeaderChange(nextValue);
      },
    } as HeaderEditorContract;

    return { applyHeaderChange, editor };
  };

  if (!editorRef.current) {
    const { applyHeaderChange, editor } = createHeaderEditor(
      context.initialHeaders,
    );
    applyUserHeaderChangeRef.current = applyHeaderChange;
    editorRef.current = editor;
  }

  useLayoutEffect(() => {
    if (editorRef.current) {
      context.setHeaderEditor(editorRef.current);
    }
  }, [context.setHeaderEditor]);

  useLayoutEffect(() => {
    const headerTextChanged = previousHeaderText.current !== headerText;
    previousHeaderText.current = headerText;

    // Model a keystroke after the debounced state commit but before GraphiQL's passive prop-sync effect.
    if (
      headerTextChanged &&
      headerText === userEditText &&
      nextHeaderTextAfterCommit
    ) {
      applyUserHeaderChangeRef.current(nextHeaderTextAfterCommit);
    }
  }, [headerText, nextHeaderTextAfterCommit, userEditText]);

  const replaceHeaderEditor = () => {
    const { applyHeaderChange, editor } = createHeaderEditor(
      context.initialHeaders,
    );
    applyUserHeaderChangeRef.current = applyHeaderChange;
    editorRef.current = editor;
    context.setHeaderEditor(editor);
    forceEditorRender();
  };

  return (
    <>
      <button type="button" onClick={() => context.addTab()}>
        Add tab
      </button>
      <button
        type="button"
        onClick={() => context.changeTab(context.activeTabIndex === 0 ? 1 : 0)}
      >
        Change tabs
      </button>
      <button type="button" onClick={replaceHeaderEditor}>
        Replace header editor
      </button>
      <button
        type="button"
        onClick={() => applyUserHeaderChangeRef.current(userEditText)}
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

interface PersistedHeadersHarnessProps {
  nextHeaderTextAfterCommit?: string;
  userEditText?: string;
}

function PersistedHeadersHarness({
  nextHeaderTextAfterCommit,
  userEditText,
}: PersistedHeadersHarnessProps) {
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
      schema={null}
      shouldPersistHeaders={false}
      storage={storage}
    >
      <ClearStorageButton />
      <ProviderHeaderEditorContract
        headerClearVersion={headerClearVersion}
        headerText={headerText}
        nextHeaderTextAfterCommit={nextHeaderTextAfterCommit}
        onEditHeaders={handleEditHeaders}
        userEditText={userEditText}
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

describe('GraphiQLProvider header contract', () => {
  beforeEach(() => {
    persistedEdits.mockClear();
    programmaticHeaderEdits.mockClear();
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

  it('passes default headers to initial HTTP introspection across mounts', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: {} });
    const renderProvider = () =>
      render(
        <GraphiQLProvider
          defaultHeaders={PERSISTED_HEADERS}
          fetcher={fetcher}
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

  it('seeds migrated legacy headers before provider storage effects can clear them', async () => {
    localStorage.setItem(UPSTREAM_HEADERS_STORAGE_KEY, PERSISTED_HEADERS);

    render(<PersistedHeadersHarness />);

    await waitFor(() => {
      expect(screen.getByTestId('active-header-value').textContent).toBe(
        `0:${PERSISTED_HEADERS}`,
      );
    });
    expect(localStorage.getItem(DASHBOARD_HEADERS_STORAGE_KEY)).toBe(
      JSON.stringify(PERSISTED_HEADERS),
    );
  });

  it('does not replace editor content newer than a debounced persistence commit', async () => {
    vi.useFakeTimers();
    localStorage.setItem(
      DASHBOARD_HEADERS_STORAGE_KEY,
      JSON.stringify(PERSISTED_HEADERS),
    );

    try {
      render(
        <PersistedHeadersHarness
          nextHeaderTextAfterCommit={UNSAVED_HEADERS}
          userEditText={STALE_COMMITTED_HEADERS}
        />,
      );

      await act(async () => {
        screen.getByRole('button', { name: 'Edit headers' }).click();
        await Promise.resolve();
        vi.advanceTimersByTime(200);
        await Promise.resolve();
      });

      expect(screen.getByTestId('active-header-value').textContent).toBe(
        `0:${UNSAVED_HEADERS}`,
      );
      expect(programmaticHeaderEdits).not.toHaveBeenCalledWith(
        STALE_COMMITTED_HEADERS,
      );

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(localStorage.getItem(DASHBOARD_HEADERS_STORAGE_KEY)).toBe(
        JSON.stringify(UNSAVED_HEADERS),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses current dashboard headers for new tabs without overwriting the active editor on external storage events', async () => {
    localStorage.setItem(
      DASHBOARD_HEADERS_STORAGE_KEY,
      JSON.stringify(PERSISTED_HEADERS),
    );
    render(<PersistedHeadersHarness />);

    await waitFor(() => {
      expect(screen.getByTestId('active-header-value').textContent).toBe(
        `0:${PERSISTED_HEADERS}`,
      );
    });

    act(() => {
      const newValue = JSON.stringify(EXTERNAL_HEADERS);
      localStorage.setItem(DASHBOARD_HEADERS_STORAGE_KEY, newValue);
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: DASHBOARD_HEADERS_STORAGE_KEY,
          newValue,
          storageArea: localStorage,
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('active-header-value').textContent).toBe(
        `0:${PERSISTED_HEADERS}`,
      );
    });
    expect(programmaticHeaderEdits).not.toHaveBeenCalledWith(EXTERNAL_HEADERS);

    act(() => {
      screen.getByRole('button', { name: 'Add tab' }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('active-header-value').textContent).toBe(
        `1:${EXTERNAL_HEADERS}`,
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

  it('keeps a clear reset across editor replacement and persists post-clear edits', async () => {
    vi.useFakeTimers();
    localStorage.setItem(
      DASHBOARD_HEADERS_STORAGE_KEY,
      JSON.stringify(PERSISTED_HEADERS),
    );

    try {
      render(<PersistedHeadersHarness />);

      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByTestId('active-header-value').textContent).toBe(
        `0:${PERSISTED_HEADERS}`,
      );

      act(() => {
        screen.getByRole('button', { name: 'Clear data' }).click();
      });
      expect(screen.getByTestId('active-header-value').textContent).toBe('0:');

      programmaticHeaderEdits.mockClear();
      act(() => {
        screen.getByRole('button', { name: 'Replace header editor' }).click();
      });
      expect(screen.getByTestId('active-header-value').textContent).toBe('0:');
      expect(programmaticHeaderEdits).not.toHaveBeenCalledWith(
        PERSISTED_HEADERS,
      );

      persistedEdits.mockClear();
      await act(async () => {
        screen.getByRole('button', { name: 'Edit headers' }).click();
        await Promise.resolve();
        vi.advanceTimersByTime(200);
      });
      expect(persistedEdits).toHaveBeenCalledWith(UNSAVED_HEADERS);
      expect(localStorage.getItem(DASHBOARD_HEADERS_STORAGE_KEY)).toBe(
        JSON.stringify(UNSAVED_HEADERS),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels an unsaved edit when clearing an already-empty dashboard state', async () => {
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

  it('clears persisted and editor headers through the real provider storage boundary', async () => {
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
