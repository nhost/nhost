import GraphiQLEditor from '@/features/orgs/projects/graphql/GraphiQLEditor/GraphiQLEditor';
import { act, render } from '@/tests/testUtils';

interface GraphiQLInterfaceProps {
  onEditHeaders: (headers: string) => void;
}

const mocks = vi.hoisted(() => ({
  editorContext: {
    activeTabIndex: 0,
    headerEditor: null,
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

describe('GraphiQLEditor', () => {
  beforeEach(() => {
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

  it('cancels pending edits on unmount', async () => {
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
