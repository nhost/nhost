import { GraphiQLProvider } from '@graphiql/react';
import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import { GraphiQLEditor } from '@/features/orgs/projects/graphql/common/components/GraphiQLEditor';
import { act, fireEvent, render, screen, waitFor } from '@/tests/testUtils';

const fetcher = vi.fn(async () => ({ data: {} }));
const rangeGetBoundingClientRect = Range.prototype.getBoundingClientRect;
const rangeGetClientRects = Range.prototype.getClientRects;

interface RenderEditorOptions {
  headers?: string;
  onHeaderChange?: (headers: Record<string, unknown>) => void;
  variables?: string;
}

function renderEditor({
  headers = '',
  onHeaderChange = vi.fn(),
  variables = '',
}: RenderEditorOptions = {}) {
  return render(
    <GraphiQLProvider
      fetcher={fetcher}
      headers={headers}
      schema={null}
      variables={variables}
    >
      <GraphiQLEditor onHeaderChange={onHeaderChange} />
    </GraphiQLProvider>,
    { wrapper: ({ children }: PropsWithChildren) => children },
  );
}

interface CodeMirrorElement extends HTMLElement {
  CodeMirror: {
    setValue: (value: string) => void;
  };
}

function setActiveEditorValue(value: string) {
  const editor = document.querySelector<CodeMirrorElement>(
    '.graphiql-editor-tool .graphiql-editor:not(.hidden) .CodeMirror',
  );

  if (!editor) {
    throw new Error('The active GraphiQL editor is not ready.');
  }

  act(() => editor.CodeMirror.setValue(value));
}

describe('GraphiQLEditor', () => {
  beforeEach(() => {
    localStorage.clear();
    Range.prototype.getBoundingClientRect = vi.fn(() => new DOMRect());
    Range.prototype.getClientRects = vi.fn(() => [] as unknown as DOMRectList);
  });

  afterAll(() => {
    Range.prototype.getBoundingClientRect = rangeGetBoundingClientRect;
    Range.prototype.getClientRects = rangeGetClientRects;
  });

  it('marks the real Variables and Headers buttons for initial content', () => {
    renderEditor({
      headers: '{"authorization":"Bearer token"}',
      variables: '{"limit":10}',
    });

    expect(screen.getByRole('button', { name: 'Variables' })).toHaveAttribute(
      'data-has-content',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Headers' })).toHaveAttribute(
      'data-has-content',
      'true',
    );
  });

  it('updates the real Variables and Headers buttons when editor content changes', async () => {
    const onHeaderChange = vi.fn();
    renderEditor({ onHeaderChange });
    const variablesButton = screen.getByRole('button', { name: 'Variables' });
    const headersButton = screen.getByRole('button', { name: 'Headers' });

    await waitFor(() => {
      expect(document.querySelectorAll('.CodeMirror')).toHaveLength(4);
    });

    setActiveEditorValue('{"limit":10}');
    fireEvent.click(headersButton);
    setActiveEditorValue('{"authorization":"Bearer token"}');

    await waitFor(() => {
      expect(variablesButton).toHaveAttribute('data-has-content', 'true');
      expect(headersButton).toHaveAttribute('data-has-content', 'true');
      expect(onHeaderChange).toHaveBeenLastCalledWith({
        authorization: 'Bearer token',
      });
    });

    fireEvent.click(variablesButton);
    setActiveEditorValue(' \n\t ');
    fireEvent.click(headersButton);
    setActiveEditorValue(' \n\t ');

    await waitFor(() => {
      expect(variablesButton).not.toHaveAttribute('data-has-content');
      expect(headersButton).not.toHaveAttribute('data-has-content');
      expect(onHeaderChange).toHaveBeenLastCalledWith({});
    });
  });
});
