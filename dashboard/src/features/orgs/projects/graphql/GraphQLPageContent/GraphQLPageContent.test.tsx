import type { Fetcher } from '@graphiql/toolkit';
import GraphQLPageContent from '@/features/orgs/projects/graphql/GraphQLPageContent/GraphQLPageContent';
import { render } from '@/tests/testUtils';

interface GraphiQLProviderProps {
  fetcher: Fetcher;
  headers?: string;
  shouldPersistHeaders?: boolean;
}

interface WebSocketClientOptions {
  connectionParams: {
    headers: Record<string, string>;
  };
}

const PERSISTED_HEADERS = '{"x-hasura-role":"public"}';
const STORAGE_KEY = 'nhost_graphql_playground_headers:local';
const mocks = vi.hoisted(() => ({
  baseFetcher: vi.fn().mockResolvedValue({ data: {} }),
  createClient: vi.fn((options: unknown) => options),
  createFetcher: vi.fn(),
  providerProps: null as GraphiQLProviderProps | null,
  subdomain: 'local',
  track: vi.fn(),
  triggerToast: vi.fn(),
}));

vi.mock('@graphiql/react', () => ({
  GraphiQLProvider: (props: GraphiQLProviderProps) => {
    mocks.providerProps = props;

    return null;
  },
}));

vi.mock('@graphiql/toolkit', () => ({
  createGraphiQLFetcher: mocks.createFetcher,
}));

vi.mock('graphql-ws', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({
    project: {
      config: { hasura: { adminSecret: 'admin-secret' } },
      region: 'local',
      subdomain: mocks.subdomain,
    },
  }),
}));

vi.mock('@/hooks/useTrackEvent', () => ({
  useTrackEvent: () => mocks.track,
}));

vi.mock('@/utils/toast', () => ({
  triggerToast: mocks.triggerToast,
}));

function getLastConnectionHeaders() {
  const options = mocks.createClient.mock.calls.at(-1)?.[0] as
    | WebSocketClientOptions
    | undefined;

  return options?.connectionParams.headers;
}

describe('GraphQLPageContent header wiring', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.baseFetcher.mockClear();
    mocks.createClient.mockClear();
    mocks.createFetcher.mockReset();
    mocks.createFetcher.mockReturnValue(mocks.baseFetcher);
    mocks.providerProps = null;
    mocks.subdomain = 'local';
    mocks.triggerToast.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restores dashboard-owned headers for the provider and WebSocket client on repeated mounts', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(PERSISTED_HEADERS));

    const { unmount } = render(<GraphQLPageContent />);

    expect(mocks.providerProps?.headers).toBe(PERSISTED_HEADERS);
    expect(mocks.providerProps?.shouldPersistHeaders).toBe(false);
    expect(getLastConnectionHeaders()).toEqual({
      'content-type': 'application/json',
      'x-hasura-admin-secret': 'admin-secret',
      'x-hasura-role': 'public',
    });

    unmount();
    localStorage.removeItem('graphiql:headers');
    render(<GraphQLPageContent />);

    expect(mocks.providerProps?.headers).toBe(PERSISTED_HEADERS);
    expect(getLastConnectionHeaders()).toEqual({
      'content-type': 'application/json',
      'x-hasura-admin-secret': 'admin-secret',
      'x-hasura-role': 'public',
    });
  });

  it('loads isolated header state when the active project changes', () => {
    const otherHeaders = '{"x-hasura-role":"editor"}';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(PERSISTED_HEADERS));
    localStorage.setItem(
      'nhost_graphql_playground_headers:other',
      JSON.stringify(otherHeaders),
    );
    const { rerender } = render(<GraphQLPageContent />);

    expect(mocks.providerProps?.headers).toBe(PERSISTED_HEADERS);

    mocks.subdomain = 'other';
    rerender(<GraphQLPageContent />);

    expect(mocks.providerProps?.headers).toBe(otherHeaders);
    expect(getLastConnectionHeaders()).toEqual({
      'content-type': 'application/json',
      'x-hasura-admin-secret': 'admin-secret',
      'x-hasura-role': 'editor',
    });
  });

  it('does not rebuild clients for an empty initial state', () => {
    render(<GraphQLPageContent />);

    expect(mocks.providerProps?.headers).toBe('');
    expect(mocks.createFetcher).toHaveBeenCalledOnce();
    expect(mocks.createClient).toHaveBeenCalledOnce();
  });

  it('reports an invalid header on execution without toasting during render', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const headerText = '{"X-Hasura-Role ":"editor"}';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(headerText));

    render(<GraphQLPageContent />);

    expect(mocks.triggerToast).not.toHaveBeenCalled();

    await mocks.providerProps?.fetcher(
      { query: 'query TestQuery { messages { id } }' },
      { headers: { 'X-Hasura-Role ': 'editor' } },
    );

    expect(mocks.triggerToast).toHaveBeenCalledOnce();
    expect(mocks.triggerToast).toHaveBeenCalledWith(
      'Invalid GraphQL header "X-Hasura-Role " was ignored. This request was sent without it.',
    );
    expect(mocks.baseFetcher).toHaveBeenCalledWith(
      { query: 'query TestQuery { messages { id } }' },
      {
        headers: {
          'content-type': 'application/json',
          'x-hasura-admin-secret': 'admin-secret',
        },
      },
    );
  });
});
