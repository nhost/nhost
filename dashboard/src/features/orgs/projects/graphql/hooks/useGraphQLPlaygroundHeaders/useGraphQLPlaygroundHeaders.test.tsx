import useGraphQLPlaygroundHeaders from '@/features/orgs/projects/graphql/hooks/useGraphQLPlaygroundHeaders/useGraphQLPlaygroundHeaders';
import { act, render, screen, waitFor } from '@/tests/testUtils';

const LEGACY_STORAGE_KEY = 'graphiql:headers';
const STORAGE_KEY = 'nhost_graphql_playground_headers:local';
const PERSISTED_HEADERS = '{"x-hasura-role":"public"}';
let updateHeaderText: ((headers: string) => void) | undefined;

interface HeadersProbeProps {
  appSubdomain?: string;
}

function HeadersProbe({ appSubdomain = 'local' }: HeadersProbeProps) {
  const { headerText, headersTabOverrides, setHeaderText } =
    useGraphQLPlaygroundHeaders(appSubdomain);
  updateHeaderText = setHeaderText;

  return (
    <>
      <output data-testid="header-text">{headerText}</output>
      <output data-testid="header-overrides">
        {JSON.stringify(headersTabOverrides)}
      </output>
    </>
  );
}

describe('useGraphQLPlaygroundHeaders', () => {
  beforeEach(() => {
    localStorage.clear();
    updateHeaderText = undefined;
  });

  it('restores persisted header text and parsed overrides across mounts', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(PERSISTED_HEADERS));

    const { unmount } = render(<HeadersProbe />);

    expect(screen.getByTestId('header-text').textContent).toBe(
      PERSISTED_HEADERS,
    );
    expect(screen.getByTestId('header-overrides').textContent).toBe(
      PERSISTED_HEADERS,
    );

    unmount();
    render(<HeadersProbe />);

    expect(screen.getByTestId('header-text').textContent).toBe(
      PERSISTED_HEADERS,
    );
    expect(screen.getByTestId('header-overrides').textContent).toBe(
      PERSISTED_HEADERS,
    );
  });

  it('migrates legacy headers once into the first project that loads', () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, PERSISTED_HEADERS);

    const { unmount } = render(<HeadersProbe />);

    expect(screen.getByTestId('header-text').textContent).toBe(
      PERSISTED_HEADERS,
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe(
      JSON.stringify(PERSISTED_HEADERS),
    );
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();

    unmount();
    render(<HeadersProbe appSubdomain="other" />);

    expect(screen.getByTestId('header-text').textContent).toBe('');
    expect(
      localStorage.getItem('nhost_graphql_playground_headers:other'),
    ).toBeNull();
  });

  it('preserves an explicit empty project state instead of migrating legacy headers', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(''));
    localStorage.setItem(LEGACY_STORAGE_KEY, PERSISTED_HEADERS);

    render(<HeadersProbe />);

    expect(screen.getByTestId('header-text').textContent).toBe('');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(''));
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
  });

  it('persists invalid JSON without replacing the last valid overrides', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(PERSISTED_HEADERS));
    render(<HeadersProbe />);

    act(() => {
      updateHeaderText?.('{invalid');
    });

    await waitFor(() => {
      expect(screen.getByTestId('header-text').textContent).toBe('{invalid');
    });
    expect(screen.getByTestId('header-overrides').textContent).toBe(
      PERSISTED_HEADERS,
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify('{invalid'));
  });

  it('clears overrides and removes persistence for an empty edit', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(PERSISTED_HEADERS));
    render(<HeadersProbe />);

    act(() => {
      updateHeaderText?.('');
    });

    await waitFor(() => {
      expect(screen.getByTestId('header-overrides').textContent).toBe('{}');
    });
    expect(screen.getByTestId('header-text').textContent).toBe('');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('ignores persisted JSON values that are not header objects', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify('[]'));

    render(<HeadersProbe />);

    expect(screen.getByTestId('header-text').textContent).toBe('[]');
    expect(screen.getByTestId('header-overrides').textContent).toBe('{}');
  });
});
