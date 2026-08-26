import GraphiQLEditor from '@/features/orgs/projects/graphql/GraphiQLEditor/GraphiQLEditor';
import { act, render } from '@/tests/testUtils';

interface GraphiQLInterfaceProps {
  onEditHeaders: (headers: string) => void;
}

const mocks = vi.hoisted(() => ({
  onEditHeaders: null as GraphiQLInterfaceProps['onEditHeaders'] | null,
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

  it('debounces header edits', () => {
    const onEditHeaders = vi.fn();

    render(<GraphiQLEditor onEditHeaders={onEditHeaders} />);

    act(() => {
      mocks.onEditHeaders?.('{"x-hasura-role":"editor"}');
      vi.advanceTimersByTime(199);
    });
    expect(onEditHeaders).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onEditHeaders).toHaveBeenCalledOnce();
    expect(onEditHeaders).toHaveBeenCalledWith('{"x-hasura-role":"editor"}');
  });

  it('forwards an empty edit after the debounce', () => {
    const onEditHeaders = vi.fn();

    render(<GraphiQLEditor onEditHeaders={onEditHeaders} />);

    act(() => {
      mocks.onEditHeaders?.('');
      vi.advanceTimersByTime(200);
    });

    expect(onEditHeaders).toHaveBeenCalledWith('');
  });

  it('cancels pending edits on unmount', () => {
    const onEditHeaders = vi.fn();
    const { unmount } = render(
      <GraphiQLEditor onEditHeaders={onEditHeaders} />,
    );

    act(() => {
      mocks.onEditHeaders?.('{"x-hasura-role":"editor"}');
    });
    unmount();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onEditHeaders).not.toHaveBeenCalled();
  });
});
