import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { DeleteNativeQueryDialog } from '@/features/orgs/projects/database/native-queries/components/DeleteNativeQueryDialog';
import { mockMatchMediaValue } from '@/tests/mocks';
import { queryClient, render, screen, waitFor } from '@/tests/testUtils';
import type { NativeQueryItem } from '@/utils/hasura-api/generated/schemas';

vi.mock('next/router', () => ({
  useRouter: () => ({
    query: {
      orgSlug: 'test',
      appSubdomain: 'local',
      dataSourceSlug: 'default',
    },
    push: vi.fn(),
  }),
}));
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

const target: NativeQueryItem = {
  root_field_name: 'authors',
  code: 'SELECT 1',
  returns: 'author',
};
let queries: NativeQueryItem[] = [];
const server = setupServer(
  http.post('https://local.hasura.local.nhost.run/v1/metadata', () =>
    HttpResponse.json({
      metadata: {
        version: 3,
        sources: [
          {
            name: 'default',
            kind: 'postgres',
            native_queries: queries,
            logical_models: [],
            tables: [],
          },
        ],
      },
      resource_version: 10,
    }),
  ),
);

describe('DeleteNativeQueryDialog', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  });
  afterEach(() => {
    queryClient.clear();
  });
  afterAll(() => server.close());

  it.each([
    'object_relationships',
    'array_relationships',
  ] as const)('warns about %s dependents without blocking deletion', async (kind) => {
    queries = [
      target,
      {
        ...target,
        root_field_name: 'books',
        [kind]: [
          {
            name: 'author',
            using: {
              column_mapping: { author_id: 'id' },
              remote_native_query: 'authors',
            },
          },
        ],
      },
    ];
    render(<DeleteNativeQueryDialog open setOpen={vi.fn()} query={target} />);
    expect(await screen.findByText(/still reference/)).toHaveTextContent(
      'books',
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('does not warn for table targets, unrelated queries, or self references', async () => {
    queries = [
      {
        ...target,
        object_relationships: [
          {
            name: 'self',
            using: {
              column_mapping: { id: 'id' },
              remote_native_query: 'authors',
            },
          },
        ],
      },
      {
        ...target,
        root_field_name: 'books',
        object_relationships: [
          {
            name: 'author',
            using: {
              column_mapping: { author_id: 'id' },
              remote_table: 'authors',
            },
          },
        ],
        array_relationships: [
          {
            name: 'other',
            using: {
              column_mapping: { id: 'id' },
              remote_native_query: 'other_query',
            },
          },
        ],
      },
    ];
    render(<DeleteNativeQueryDialog open setOpen={vi.fn()} query={target} />);
    await waitFor(() =>
      expect(
        queryClient.getQueryData([EXPORT_METADATA_QUERY_KEY, 'local']),
      ).toBeDefined(),
    );
    expect(screen.queryByText(/still reference/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
  });
});
