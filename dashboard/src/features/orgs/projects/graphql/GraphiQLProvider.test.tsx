import { GraphiQLProvider, useEditorContext } from '@graphiql/react';
import { cleanup, render, screen } from '@/tests/testUtils';

const GRAPHQL_HEADERS_STORAGE_KEY = 'graphiql:headers';
const PERSISTED_HEADERS = '{"x-hasura-role":"public"}';

function InitialHeadersProbe() {
  const { initialHeaders } = useEditorContext({ nonNull: true });

  return <output data-testid="initial-headers">{initialHeaders}</output>;
}

describe('GraphiQLProvider persisted headers contract', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('restores the persisted headers as the editor initial headers', () => {
    localStorage.setItem(GRAPHQL_HEADERS_STORAGE_KEY, PERSISTED_HEADERS);

    render(
      <GraphiQLProvider fetcher={vi.fn()} schema={null}>
        <InitialHeadersProbe />
      </GraphiQLProvider>,
    );

    expect(screen.getByTestId('initial-headers').textContent).toBe(
      PERSISTED_HEADERS,
    );
  });
});
