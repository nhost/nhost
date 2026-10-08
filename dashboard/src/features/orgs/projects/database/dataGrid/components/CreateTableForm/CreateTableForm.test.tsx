import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { mockApplication, mockRouter } from '@/tests/mocks';
import {
  mockScrollIntoViewAndPointerCapture,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import CreateTableForm from './CreateTableForm';

mockScrollIntoViewAndPointerCapture();

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  useProject: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

const HASURA_URL = 'https://local.hasura.local.nhost.run';

const project = {
  ...mockApplication,
  subdomain: 'local',
  region: { ...mockApplication.region, name: 'local' },
};

interface MetadataRequest {
  type: string;
  resource_version?: number;
  args?: unknown;
}

let serverResourceVersion = 70;
const metadataRequests: MetadataRequest[] = [];
const sqlStatements: string[] = [];

const server = setupServer(
  http.post(`${HASURA_URL}/v2/query`, async ({ request }) => {
    const body = (await request.json()) as {
      args: Array<{ args: { sql: string } }>;
    };
    const statements = body.args.map(({ args }) => args.sql);
    sqlStatements.push(...statements);

    if (statements.some((sql) => /\bcomment on\b/i.test(sql))) {
      serverResourceVersion += 1;
    }

    return HttpResponse.json(
      statements.map(() => ({ result_type: 'CommandOk', result: null })),
    );
  }),
  http.post(`${HASURA_URL}/v1/metadata`, async ({ request }) => {
    const body = (await request.json()) as MetadataRequest;
    metadataRequests.push(body);

    if (body.type === 'export_metadata') {
      return HttpResponse.json({
        resource_version: serverResourceVersion,
        metadata: {
          version: 3,
          sources: [{ name: 'default', kind: 'postgres', tables: [] }],
        },
      });
    }

    if (body.resource_version !== serverResourceVersion) {
      return HttpResponse.json(
        {
          error: `metadata resource version referenced (${body.resource_version}) did not match current version`,
          path: '$',
          code: 'conflict',
        },
        { status: 409 },
      );
    }

    serverResourceVersion += 1;
    return HttpResponse.json([{ message: 'success' }]);
  }),
);

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
  server.listen({ onUnhandledRequest: 'warn' });
});

beforeEach(() => {
  serverResourceVersion = 70;
  metadataRequests.length = 0;
  sqlStatements.length = 0;
  mocks.useRouter.mockReturnValue({
    ...mockRouter,
    query: { ...mockRouter.query, dataSourceSlug: 'default' },
  });
  mocks.useProject.mockReturnValue({ project, loading: false });
});

afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
});

afterAll(() => {
  server.close();
  vi.unstubAllEnvs();
});

test('tracks a table with column comments using the version after table creation', async () => {
  const user = new TestUserEvent();
  render(<CreateTableForm schema="public" redirectOnSuccess={false} />);

  await waitFor(() =>
    expect(
      queryClient.getQueryData([EXPORT_METADATA_QUERY_KEY, project.subdomain]),
    ).toMatchObject({ resource_version: 70 }),
  );

  await user.type(screen.getByTestId('tableNameInput'), 'articles');
  await user.type(screen.getByTestId('columns.1.name'), 'title');
  await user.click(screen.getByTestId('columns.1.type'));
  await user.click(screen.getByRole('option', { name: /^text.*text/ }));
  await user.click(screen.getByTestId('columns.0.comment'));
  await user.type(
    screen.getByPlaceholderText('Add a comment for the column'),
    'Article ID{Escape}',
  );

  await user.click(screen.getByRole('button', { name: 'Create' }));

  await waitFor(() =>
    expect(metadataRequests).toContainEqual(
      expect.objectContaining({ type: 'bulk' }),
    ),
  );
  expect(sqlStatements).toContainEqual(
    expect.stringContaining('COMMENT ON COLUMN'),
  );
  expect(metadataRequests.filter(({ type }) => type === 'bulk')).toMatchObject([
    {
      resource_version: 71,
      args: [
        {
          type: 'pg_track_table',
          args: {
            source: 'default',
            table: { name: 'articles', schema: 'public' },
          },
        },
      ],
    },
  ]);
  expect(
    screen.queryByText(/did not match current version/),
  ).not.toBeInTheDocument();
});
