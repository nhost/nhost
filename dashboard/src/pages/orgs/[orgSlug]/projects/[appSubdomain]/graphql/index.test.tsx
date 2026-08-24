import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import { GraphiQLEditor } from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/graphql';
import { act, fireEvent, render, screen } from '@/tests/testUtils';

vi.mock('@graphiql/react', () => ({
  DOC_EXPLORER_PLUGIN: { title: 'Documentation Explorer' },
  GraphiQLProvider: ({ children }: PropsWithChildren) => children,
  useCopyQuery: vi.fn(),
  useEditorContext: () => ({
    initialHeaders: '{}',
    initialVariables: '{}',
  }),
  useExecutionContext: vi.fn(),
  usePluginContext: vi.fn(),
  usePrettifyEditors: vi.fn(),
  useTheme: vi.fn(),
}));

vi.mock('graphiql', () => ({
  GraphiQLInterface: ({
    onEditHeaders,
  }: {
    onEditHeaders: (headers: string) => void;
  }) => (
    <>
      <button
        type="button"
        onClick={() => onEditHeaders('{"authorization":"Bearer token"}')}
      >
        Set valid headers
      </button>
      <button type="button" onClick={() => onEditHeaders(' \n\t ')}>
        Set whitespace headers
      </button>
      <div className="graphiql-editor-tools">
        <button type="button" data-name="variables">
          Variables
        </button>
        <button type="button" data-name="headers">
          Headers
        </button>
      </div>
    </>
  ),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

describe('GraphiQLEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears parsed headers and the indicator when headers become whitespace', () => {
    const onHeaderChange = vi.fn();
    render(<GraphiQLEditor onHeaderChange={onHeaderChange} />);

    const headersTab = screen.getByRole('button', { name: 'Headers' });

    fireEvent.click(screen.getByRole('button', { name: 'Set valid headers' }));
    act(() => vi.advanceTimersByTime(200));

    expect(onHeaderChange).toHaveBeenLastCalledWith({
      authorization: 'Bearer token',
    });
    expect(headersTab).toHaveAttribute('data-has-content', 'true');

    fireEvent.click(
      screen.getByRole('button', { name: 'Set whitespace headers' }),
    );
    act(() => vi.advanceTimersByTime(200));

    expect(onHeaderChange).toHaveBeenLastCalledWith({});
    expect(headersTab).not.toHaveAttribute('data-has-content');
  });
});
