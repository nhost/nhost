import GraphiQLEditor from '@/features/orgs/projects/graphql/GraphiQLEditor/GraphiQLEditor';
import { act, render } from '@/tests/testUtils';

interface GraphiQLInterfaceProps {
  onEditHeaders: (headers: string) => void;
}

interface HeaderEditorContract {
  getValue: () => string;
  setValue: (nextHeaderText: string) => void;
}

const mocks = vi.hoisted(() => ({
  editorContext: {
    activeTabIndex: 0,
    headerEditor: null as HeaderEditorContract | null,
    tabs: [{ id: 'tab-1' }],
    updateActiveTabValues: vi.fn(),
  },
  onEditHeaders: null as GraphiQLInterfaceProps['onEditHeaders'] | null,
}));

vi.mock('@graphiql/react', () => ({
  useEditorContext: () => mocks.editorContext,
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

function renderWithHeaderEditor(
  onEditHeaders: GraphiQLInterfaceProps['onEditHeaders'],
) {
  let editorValue = '';
  const applyEditorChange = (nextHeaderText: string) => {
    editorValue = nextHeaderText;
    mocks.onEditHeaders?.(nextHeaderText);
  };
  const headerEditor: HeaderEditorContract = {
    getValue: () => editorValue,
    setValue: vi.fn(applyEditorChange),
  };
  const rendered = render(
    <GraphiQLEditor
      headerClearVersion={0}
      headerText=""
      onEditHeaders={onEditHeaders}
    />,
  );

  mocks.editorContext.headerEditor = headerEditor;
  rendered.rerender(
    <GraphiQLEditor
      headerClearVersion={0}
      headerText=""
      onEditHeaders={onEditHeaders}
    />,
  );
  mocks.editorContext.updateActiveTabValues.mockClear();

  return {
    ...rendered,
    applyEditorChange,
    getEditorValue: () => editorValue,
    headerEditor,
  };
}

describe('GraphiQLEditor', () => {
  beforeEach(() => {
    mocks.editorContext.activeTabIndex = 0;
    mocks.editorContext.headerEditor = null;
    mocks.editorContext.tabs = [{ id: 'tab-1' }];
    mocks.editorContext.updateActiveTabValues.mockReset();
    mocks.onEditHeaders = null;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces header edits', async () => {
    const onEditHeaders = vi.fn();

    render(
      <GraphiQLEditor
        headerClearVersion={0}
        headerText=""
        onEditHeaders={onEditHeaders}
      />,
    );

    await act(async () => {
      mocks.onEditHeaders?.('{"x-hasura-role":"editor"}');
      await Promise.resolve();
      vi.advanceTimersByTime(199);
    });
    expect(onEditHeaders).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onEditHeaders).toHaveBeenCalledOnce();
    expect(onEditHeaders).toHaveBeenCalledWith('{"x-hasura-role":"editor"}');
  });

  it('delivers an armed edit through the latest callback identity', async () => {
    const initialOnEditHeaders = vi.fn();
    const latestOnEditHeaders = vi.fn();
    const { rerender } = render(
      <GraphiQLEditor
        headerClearVersion={0}
        headerText=""
        onEditHeaders={initialOnEditHeaders}
      />,
    );

    await act(async () => {
      mocks.onEditHeaders?.('{"x-hasura-role":"editor"}');
      await Promise.resolve();
    });

    rerender(
      <GraphiQLEditor
        headerClearVersion={0}
        headerText=""
        onEditHeaders={latestOnEditHeaders}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(initialOnEditHeaders).not.toHaveBeenCalled();
    expect(latestOnEditHeaders).toHaveBeenCalledOnce();
    expect(latestOnEditHeaders).toHaveBeenCalledWith(
      '{"x-hasura-role":"editor"}',
    );
  });

  it.each([
    ['non-empty', '{"a":12}'],
    ['empty', ''],
  ])(
    'keeps a second %s edit through a stale parent commit and tab restore',
    async (_caseName, secondHeaders) => {
      const firstHeaders = '{"a":1}';
      const onEditHeaders = vi.fn();
      const { applyEditorChange, getEditorValue, headerEditor, rerender } =
        renderWithHeaderEditor(onEditHeaders);

      await act(async () => {
        applyEditorChange(firstHeaders);
        await Promise.resolve();
        vi.advanceTimersByTime(200);
      });
      expect(onEditHeaders).toHaveBeenCalledWith(firstHeaders);

      applyEditorChange(secondHeaders);
      await Promise.resolve();

      mocks.editorContext.activeTabIndex = 1;
      mocks.editorContext.tabs = [{ id: 'tab-1' }, { id: 'tab-2' }];
      rerender(
        <GraphiQLEditor
          headerClearVersion={0}
          headerText={firstHeaders}
          onEditHeaders={onEditHeaders}
        />,
      );

      expect(getEditorValue()).toBe(secondHeaders);
      expect(headerEditor.setValue).not.toHaveBeenCalledWith(firstHeaders);
      expect(
        mocks.editorContext.updateActiveTabValues,
      ).toHaveBeenLastCalledWith({
        headers: secondHeaders,
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(onEditHeaders).toHaveBeenNthCalledWith(2, secondHeaders);
    },
  );

  it('adopts an external update after a committed local edit', async () => {
    const localHeaders = '{"local":true}';
    const externalHeaders = '{"external":true}';
    const onEditHeaders = vi.fn();
    const { applyEditorChange, getEditorValue, headerEditor, rerender } =
      renderWithHeaderEditor(onEditHeaders);

    await act(async () => {
      applyEditorChange(localHeaders);
      await Promise.resolve();
      vi.advanceTimersByTime(200);
    });
    rerender(
      <GraphiQLEditor
        headerClearVersion={0}
        headerText={localHeaders}
        onEditHeaders={onEditHeaders}
      />,
    );

    mocks.editorContext.activeTabIndex = 1;
    mocks.editorContext.tabs = [{ id: 'tab-1' }, { id: 'tab-2' }];
    rerender(
      <GraphiQLEditor
        headerClearVersion={0}
        headerText={externalHeaders}
        onEditHeaders={onEditHeaders}
      />,
    );

    expect(getEditorValue()).toBe(externalHeaders);
    expect(headerEditor.setValue).toHaveBeenLastCalledWith(externalHeaders);
    expect(mocks.editorContext.updateActiveTabValues).toHaveBeenLastCalledWith({
      headers: externalHeaders,
    });
  });

  it('adopts an external update after Clear data cancels a local edit', async () => {
    const localHeaders = '{"local":true}';
    const externalHeaders = '{"external":true}';
    const onEditHeaders = vi.fn();
    const { applyEditorChange, getEditorValue, headerEditor, rerender } =
      renderWithHeaderEditor(onEditHeaders);

    applyEditorChange(localHeaders);
    await Promise.resolve();
    rerender(
      <GraphiQLEditor
        headerClearVersion={1}
        headerText=""
        onEditHeaders={onEditHeaders}
      />,
    );
    await Promise.resolve();

    mocks.editorContext.activeTabIndex = 1;
    mocks.editorContext.tabs = [{ id: 'tab-1' }, { id: 'tab-2' }];
    rerender(
      <GraphiQLEditor
        headerClearVersion={1}
        headerText={externalHeaders}
        onEditHeaders={onEditHeaders}
      />,
    );

    expect(getEditorValue()).toBe(externalHeaders);
    expect(headerEditor.setValue).toHaveBeenLastCalledWith(externalHeaders);
    expect(mocks.editorContext.updateActiveTabValues).toHaveBeenLastCalledWith({
      headers: externalHeaders,
    });
    expect(onEditHeaders).not.toHaveBeenCalled();
  });

  it('forwards an empty edit after the debounce', async () => {
    const onEditHeaders = vi.fn();

    render(
      <GraphiQLEditor
        headerClearVersion={0}
        headerText='{"x-hasura-role":"editor"}'
        onEditHeaders={onEditHeaders}
      />,
    );

    await act(async () => {
      mocks.onEditHeaders?.('');
      await Promise.resolve();
      vi.advanceTimersByTime(200);
    });

    expect(onEditHeaders).toHaveBeenCalledWith('');
  });

  it('flushes the final pending edit exactly once on unmount', async () => {
    const onEditHeaders = vi.fn();
    const finalHeaders = '{"x-hasura-role":"editor"}';
    const { unmount } = render(
      <GraphiQLEditor
        headerClearVersion={0}
        headerText=""
        onEditHeaders={onEditHeaders}
      />,
    );

    await act(async () => {
      mocks.onEditHeaders?.(finalHeaders);
      await Promise.resolve();
    });
    expect(onEditHeaders).not.toHaveBeenCalled();

    unmount();

    expect(onEditHeaders).toHaveBeenCalledOnce();
    expect(onEditHeaders).toHaveBeenCalledWith(finalHeaders);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onEditHeaders).toHaveBeenCalledOnce();
  });

  it('does not arm a debounce for an edit still queued at unmount', async () => {
    const onEditHeaders = vi.fn();
    const { unmount } = render(
      <GraphiQLEditor
        headerClearVersion={0}
        headerText=""
        onEditHeaders={onEditHeaders}
      />,
    );

    act(() => {
      mocks.onEditHeaders?.('{"x-hasura-role":"editor"}');
    });
    unmount();

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(200);
    });

    expect(onEditHeaders).not.toHaveBeenCalled();
  });
});
