import type { Fetcher, Storage } from '@graphiql/toolkit';
import { Children, isValidElement, type ReactNode } from 'react';
import type { GraphQLPlaygroundSelection } from '@/features/orgs/projects/graphql/common/utils/composeRequestHeaders';
import GraphQLPageContent from '@/features/orgs/projects/graphql/GraphQLPageContent/GraphQLPageContent';
import { act, render, waitFor } from '@/tests/testUtils';

interface GraphiQLProviderProps {
  children?: ReactNode;
  fetcher: Fetcher;
  headers?: string;
  shouldPersistHeaders?: boolean;
  storage?: Storage;
}

interface GraphiQLEditorProps {
  onEditHeaders: (headers: string) => void;
}

interface GraphiQLHeaderProps {
  onSelectionChange: (selection: GraphQLPlaygroundSelection) => void;
}

type GraphiQLChildProps = Partial<GraphiQLEditorProps & GraphiQLHeaderProps>;

interface WebSocketClientOptions {
  connectionParams: () => {
    headers: Record<string, string>;
  };
}

const PERSISTED_HEADERS = '{"x-hasura-role":"public"}';
const STORAGE_KEY = 'nhost_graphql_playground_headers:local';
const mocks = vi.hoisted(() => ({
  baseFetcher: vi.fn().mockResolvedValue({ data: {} }),
  createClient: vi.fn((options: unknown) => options),
  createFetcher: vi.fn(),
  editHeaders: null as GraphiQLEditorProps['onEditHeaders'] | null,
  providerProps: null as GraphiQLProviderProps | null,
  selectRole: null as GraphiQLHeaderProps['onSelectionChange'] | null,
  subdomain: 'local',
  track: vi.fn(),
  triggerToast: vi.fn(),
}));

vi.mock('@graphiql/react', () => ({
  GraphiQLProvider: (props: GraphiQLProviderProps) => {
    mocks.providerProps = props;
    Children.forEach(props.children, (child) => {
      if (!isValidElement<GraphiQLChildProps>(child)) {
        return;
      }

      mocks.editHeaders = child.props.onEditHeaders ?? mocks.editHeaders;
      mocks.selectRole = child.props.onSelectionChange ?? mocks.selectRole;
    });

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

  return options?.connectionParams().headers;
}

describe('GraphQLPageContent header wiring', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.baseFetcher.mockClear();
    mocks.createClient.mockClear();
    mocks.createFetcher.mockReset();
    mocks.createFetcher.mockReturnValue(mocks.baseFetcher);
    mocks.editHeaders = null;
    mocks.providerProps = null;
    mocks.selectRole = null;
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

  it('migrates legacy headers before the provider can clear them', () => {
    localStorage.setItem('graphiql:headers', PERSISTED_HEADERS);

    render(<GraphQLPageContent />);

    expect(mocks.providerProps?.headers).toBe(PERSISTED_HEADERS);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(
      JSON.stringify(PERSISTED_HEADERS),
    );
    expect(localStorage.getItem('graphiql:headers')).toBeNull();
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

  it('clears the controlled state and keeps it empty across mounts', async () => {
    const otherStorageKey = 'nhost_graphql_playground_headers:other';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(PERSISTED_HEADERS));
    localStorage.setItem(otherStorageKey, JSON.stringify(PERSISTED_HEADERS));
    const { unmount } = render(<GraphQLPageContent />);

    act(() => {
      mocks.providerProps?.storage?.clear();
    });

    await waitFor(() => {
      expect(mocks.providerProps?.headers).toBe('');
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(otherStorageKey)).toBeNull();

    unmount();
    render(<GraphQLPageContent />);

    expect(mocks.providerProps?.headers).toBe('');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('does not rebuild clients for an empty initial state', () => {
    render(<GraphQLPageContent />);

    expect(mocks.providerProps?.headers).toBe('');
    expect(mocks.createFetcher).toHaveBeenCalledOnce();
    expect(mocks.createClient).toHaveBeenCalledOnce();
  });

  it('keeps clients stable across header edits while new connections use the latest headers', async () => {
    render(<GraphQLPageContent />);

    act(() => {
      mocks.editHeaders?.('{"X-Request-Id":"first"}');
    });

    await waitFor(() => {
      expect(mocks.providerProps?.headers).toBe('{"X-Request-Id":"first"}');
    });
    expect(mocks.createFetcher).toHaveBeenCalledOnce();
    expect(mocks.createClient).toHaveBeenCalledOnce();
    expect(getLastConnectionHeaders()).toEqual({
      'content-type': 'application/json',
      'x-hasura-admin-secret': 'admin-secret',
      'x-request-id': 'first',
    });

    act(() => {
      mocks.editHeaders?.('{"X-Request-Id": "second"}');
    });

    await waitFor(() => {
      expect(getLastConnectionHeaders()).toEqual({
        'content-type': 'application/json',
        'x-hasura-admin-secret': 'admin-secret',
        'x-request-id': 'second',
      });
    });
    expect(mocks.createFetcher).toHaveBeenCalledOnce();
    expect(mocks.createClient).toHaveBeenCalledOnce();

    act(() => {
      mocks.selectRole?.({ userId: 'user-1', role: 'user' });
    });

    expect(mocks.createFetcher).toHaveBeenCalledTimes(2);
    expect(mocks.createClient).toHaveBeenCalledTimes(2);
    expect(getLastConnectionHeaders()).toEqual({
      'content-type': 'application/json',
      'x-hasura-admin-secret': 'admin-secret',
      'x-hasura-role': 'user',
      'x-hasura-user-id': 'user-1',
      'x-request-id': 'second',
    });
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
