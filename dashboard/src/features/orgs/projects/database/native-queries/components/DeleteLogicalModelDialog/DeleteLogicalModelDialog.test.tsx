import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { act } from 'react';
import { toast } from 'react-hot-toast';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { DeleteLogicalModelDialog } from '@/features/orgs/projects/database/native-queries/components/DeleteLogicalModelDialog';
import { mockMatchMediaValue } from '@/tests/mocks';
import { queryClient, render, screen, waitFor } from '@/tests/testUtils';
import type {
  LogicalModelItem,
  NativeQueryItem,
} from '@/utils/hasura-api/generated/schemas';

const mocks = vi.hoisted(() => ({
  router: {
    query: {
      orgSlug: 'test',
      appSubdomain: 'local',
      dataSourceSlug: 'default',
      modelSlug: 'book',
    },
    push: vi.fn(),
  },
}));

vi.mock('next/router', () => ({ useRouter: () => mocks.router }));
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({
    project: {
      subdomain: 'local',
      region: { name: 'local', domain: 'nhost.run' },
      config: { hasura: { adminSecret: 'nhost-admin-secret' } },
    },
  }),
}));
vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: () => true,
}));

const author: LogicalModelItem = {
  name: 'author',
  fields: [{ name: 'id', type: { scalar: 'uuid', nullable: false } }],
};

function metadataHandler({
  logicalModels,
  nativeQueries,
}: {
  logicalModels: LogicalModelItem[];
  nativeQueries: NativeQueryItem[];
}) {
  return http.post('https://local.hasura.local.nhost.run/v1/metadata', () => {
    return HttpResponse.json({
      metadata: {
        version: 3,
        sources: [
          {
            name: 'default',
            kind: 'postgres',
            logical_models: logicalModels,
            native_queries: nativeQueries,
            tables: [],
          },
        ],
      },
      resource_version: 10,
    });
  });
}

const server = setupServer(
  metadataHandler({ logicalModels: [author], nativeQueries: [] }),
);

function renderDialog() {
  return render(
    <DeleteLogicalModelDialog open setOpen={vi.fn()} model={author} />,
  );
}

function waitForLoadedMetadata() {
  return waitFor(() =>
    expect(
      queryClient.getQueryData([EXPORT_METADATA_QUERY_KEY, 'local']),
    ).toBeDefined(),
  );
}

describe('DeleteLogicalModelDialog', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  });

  afterEach(() => {
    server.resetHandlers();
    queryClient.clear();
    vi.clearAllMocks();
    act(() => toast.remove());
  });

  afterAll(() => server.close());

  it('asks for confirmation without a warning when nothing references the model', async () => {
    renderDialog();

    await waitForLoadedMetadata();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByText('author')).toBeInTheDocument();
    expect(screen.queryByText(/still reference/)).not.toBeInTheDocument();
  });

  it('lists dependent native queries and logical models', async () => {
    server.use(
      metadataHandler({
        logicalModels: [
          author,
          {
            name: 'book',
            fields: [
              { name: 'title', type: { scalar: 'text', nullable: false } },
              {
                name: 'written_by',
                type: { logical_model: 'author', nullable: false },
              },
              {
                name: 'reviewers',
                type: {
                  array: { logical_model: 'author', nullable: false },
                  nullable: false,
                },
              },
            ],
          },
        ],
        nativeQueries: [
          {
            root_field_name: 'search_authors',
            code: 'SELECT 1',
            returns: 'author',
          },
          {
            root_field_name: 'search_books',
            code: 'SELECT 1',
            returns: 'book',
          },
        ],
      }),
    );

    renderDialog();

    expect(await screen.findByText(/still reference/)).toBeInTheDocument();
    expect(screen.getByText('search_authors')).toBeInTheDocument();
    expect(screen.queryByText('search_books')).not.toBeInTheDocument();
    expect(
      screen.getByText('book (written_by, reviewers)'),
    ).toBeInTheDocument();
  });

  it('keeps deletion available so the server stays the source of truth', async () => {
    server.use(
      metadataHandler({
        logicalModels: [
          author,
          {
            name: 'book',
            fields: [
              {
                name: 'written_by',
                type: { logical_model: 'author', nullable: false },
              },
            ],
          },
        ],
        nativeQueries: [],
      }),
    );

    renderDialog();

    await waitFor(() =>
      expect(screen.getByText(/still reference/)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
  });
});
