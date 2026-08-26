import { GraphiQLProvider, useEditorContext } from '@graphiql/react';
import { render, screen, waitFor } from '@/tests/testUtils';

const UPSTREAM_HEADERS_STORAGE_KEY = 'graphiql:headers';
const PERSISTED_HEADERS = '{"x-hasura-role":"public"}';

function InitialHeadersProbe() {
  const { initialHeaders } = useEditorContext({ nonNull: true });

  return <output data-testid="initial-headers">{initialHeaders}</output>;
}

describe('GraphiQLProvider controlled headers contract', () => {
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
});
