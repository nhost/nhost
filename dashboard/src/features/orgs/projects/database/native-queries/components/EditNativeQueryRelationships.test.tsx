import { delay, HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { act } from 'react';
import { toast } from 'react-hot-toast';
import { vi } from 'vitest';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import EditNativeQueryRelationships from '@/features/orgs/projects/database/native-queries/components/EditNativeQueryRelationships';
import {
  fireEvent,
  queryClient,
  render,
  screen,
  waitFor,
} from '@/tests/testUtils';
import type {
  LogicalModelItem,
  NativeQueryItem,
} from '@/utils/hasura-api/generated/schemas';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  router: {
    asPath:
      '/orgs/test/projects/local/database/native-queries/default/queries/authors',
    query: {
      orgSlug: 'test',
      appSubdomain: 'local',
      dataSourceSlug: 'default',
      querySlug: 'authors',
    },
    push: vi.fn(),
    back: vi.fn(),
    events: { on: vi.fn(), off: vi.fn() },
  },
}));

vi.mock('next/router', () => ({ useRouter: () => mocks.router }));
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation',
  () => ({
    default: () => ({
      mutateAsync: mocks.mutateAsync,
      reset: vi.fn(),
      isPending: false,
    }),
  }),
);

const model: LogicalModelItem = {
  name: 'author_model',
  fields: [{ name: 'id', type: { scalar: 'uuid', nullable: false } }],
};
const existingRelationship = {
  name: 'manager',
  using: {
    column_mapping: { id: 'id' },
    insertion_order: null,
    remote_native_query: 'authors',
  },
};
const query: NativeQueryItem = {
  root_field_name: 'authors',
  type: 'query',
  arguments: {},
  code: 'SELECT id FROM authors',
  returns: 'author_model',
  object_relationships: [existingRelationship],
  array_relationships: [],
};

function metadataHandler(nativeQueries: NativeQueryItem[], responseDelay = 0) {
  return http.post(
    'https://local.hasura.local.nhost.run/v1/metadata',
    async () => {
      if (responseDelay > 0) {
        await delay(responseDelay);
      }

      return HttpResponse.json({
        metadata: {
          version: 3,
          sources: [
            {
              name: 'default',
              kind: 'postgres',
              native_queries: nativeQueries,
              logical_models: [model],
              tables: [],
            },
          ],
        },
        resource_version: 10,
      });
    },
  );
}

function chooseOption(comboboxName: string, optionName: string) {
  fireEvent.keyDown(screen.getByRole('combobox', { name: comboboxName }), {
    key: 'Enter',
  });
  fireEvent.click(screen.getByRole('option', { name: optionName }));
}

const server = setupServer(metadataHandler([query]));

describe('EditNativeQueryRelationships', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
    window.matchMedia = vi.fn().mockImplementation((media: string) => ({
      matches: false,
      media,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  beforeEach(() => {
    mocks.mutateAsync.mockResolvedValue({ message: 'success' });
  });

  afterEach(() => {
    server.resetHandlers();
    queryClient.clear();
    vi.clearAllMocks();
    act(() => toast.remove());
  });

  afterAll(() => server.close());

  it('shows a loading state while metadata is being fetched', () => {
    server.use(metadataHandler([query], 1_000));

    render(<EditNativeQueryRelationships queryName="authors" />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(
      screen.getByText('Loading native query relationships...'),
    ).toBeInTheDocument();
  });

  it('lists relationships with target links and closes from Back', async () => {
    const onCancel = vi.fn();
    render(
      <EditNativeQueryRelationships queryName="authors" onCancel={onCancel} />,
    );

    expect(await screen.findByText('1 object · 0 array')).toBeInTheDocument();
    expect(screen.getByText('manager')).toBeInTheDocument();
    expect(screen.getByText('· 1 mapping(s)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'authors' })).toHaveAttribute(
      'href',
      '/orgs/test/projects/local/database/native-queries/default/queries/authors',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('keeps Back available when the native query no longer exists', async () => {
    const onCancel = vi.fn();
    server.use(metadataHandler([]));
    render(
      <EditNativeQueryRelationships queryName="missing" onCancel={onCancel} />,
    );

    expect(
      await screen.findByText('Native query missing no longer exists.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('uses refreshed metadata for a second relationship mutation', async () => {
    const initialQuery: NativeQueryItem = {
      ...query,
      object_relationships: [],
    };
    server.use(metadataHandler([initialQuery]));
    render(<EditNativeQueryRelationships queryName="authors" />);

    expect(await screen.findByText('0 object · 0 array')).toBeInTheDocument();

    const refreshedQuery: NativeQueryItem = {
      ...initialQuery,
      object_relationships: [existingRelationship],
    };
    server.use(metadataHandler([refreshedQuery]));
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: [EXPORT_METADATA_QUERY_KEY, 'local'],
      });
    });

    expect(await screen.findByText('1 object · 0 array')).toBeInTheDocument();
    expect(screen.getByText('manager')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Relationship' }));
    fireEvent.change(screen.getByLabelText('Relationship Name'), {
      target: { value: 'reports' },
    });
    chooseOption('Target Native Query', 'authors');
    fireEvent.click(screen.getByRole('button', { name: 'Add New Mapping' }));
    const relationshipForm = screen
      .getByRole('button', { name: 'Create Relationship' })
      .closest('form');
    expect(relationshipForm).not.toBeNull();
    if (relationshipForm) {
      fireEvent.submit(relationshipForm);
    }

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        original: refreshedQuery,
        args: expect.objectContaining({
          source: 'default',
          object_relationships: [
            existingRelationship,
            {
              name: 'reports',
              using: {
                column_mapping: { id: 'id' },
                insertion_order: null,
                remote_native_query: 'authors',
              },
            },
          ],
        }),
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Create Relationship' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('heading', { name: 'Relationships' }),
    ).toBeInTheDocument();
    expect(screen.getByText('manager')).toBeInTheDocument();
  });
});
