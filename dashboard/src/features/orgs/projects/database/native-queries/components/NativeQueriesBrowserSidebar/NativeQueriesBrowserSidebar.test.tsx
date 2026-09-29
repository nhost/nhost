import { delay, HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { act } from 'react';
import { toast } from 'react-hot-toast';
import { NativeQueriesBrowserSidebar } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';
import type {
  CreateLogicalModelSelectPermissionStep,
  LogicalModelItem,
  MigrationRequest,
  NativeQueryAtomicMigrationStep,
  NativeQueryItem,
} from '@/utils/hasura-api/generated/schemas';

const mocks = vi.hoisted(() => ({
  routeChangeStart: undefined as VoidFunction | undefined,
  router: {
    asPath:
      '/orgs/test/projects/local/database/native-queries/default/models/author_result',
    query: {
      orgSlug: 'test',
      appSubdomain: 'local',
      dataSourceSlug: 'default',
      modelSlug: 'author_result',
    },
    push: vi.fn(),
    events: { on: vi.fn(), off: vi.fn() },
  },
}));

vi.mock('next/router', () => ({ useRouter: () => mocks.router }));
vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: () => false,
}));
vi.mock('@/features/orgs/hooks/useRemoteApplicationGQLClient', () => ({
  useRemoteApplicationGQLClient: () => ({}),
}));
vi.mock('@/generated/graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/generated/graphql')>();
  return {
    ...actual,
    useGetRemoteAppRolesQuery: () => ({
      data: { authRoles: [{ role: 'user' }, { role: 'editor' }] },
      loading: false,
      error: undefined,
    }),
  };
});
vi.mock('@uiw/react-codemirror', () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange?: (value: string) => void;
  }) => (
    <textarea
      aria-label="SQL editor"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({
    loading: false,
    project: {
      subdomain: 'local',
      region: 'local',
      config: { hasura: { adminSecret: 'secret' } },
    },
  }),
}));

const hasuraMetadataFixture = {
  metadata: {
    version: 3,
    sources: [
      {
        name: 'default',
        kind: 'postgres',
        native_queries: [
          {
            root_field_name: 'search_authors',
            type: 'query',
            arguments: {
              search: {
                type: 'text',
                nullable: false,
                description: '  Search text  ',
              },
              blank_description: {
                type: 'uuid',
                nullable: true,
                description: '   ',
              },
            },
            code: 'SELECT * FROM authors WHERE name ILIKE {{search}}',
            returns: 'author_result',
            description: 'Searches authors',
            object_relationships: [
              {
                name: 'featured_author',
                using: {
                  column_mapping: { id: 'id' },
                  insertion_order: null,
                  remote_native_query: 'featured_author',
                },
              },
            ],
            array_relationships: [
              {
                name: 'related_authors',
                using: {
                  column_mapping: { id: 'id' },
                  insertion_order: 'after_parent',
                  remote_native_query: 'search_authors',
                },
              },
            ],
          },
        ],
        logical_models: [
          {
            name: 'author_result',
            description: '  Author records returned by search  ',
            fields: [
              {
                name: 'id',
                type: { scalar: 'uuid', nullable: false },
                description: '  Primary identifier  ',
              },
              {
                name: 'display_name',
                type: { scalar: 'text', nullable: true },
                description: '   ',
              },
            ],
            select_permissions: [
              {
                role: 'user',
                permission: { columns: '*', filter: {} },
              },
            ],
          },
          {
            name: 'author_collection',
            fields: [
              {
                name: 'authors',
                type: {
                  array: {
                    logical_model: 'author_result',
                    nullable: false,
                  },
                  nullable: false,
                },
              },
            ],
          },
        ],
        tables: [],
      },
    ],
  },
  resource_version: 10,
};

type RecordedMetadataMigration = Omit<MigrationRequest, 'up'> & {
  up: [
    NativeQueryAtomicMigrationStep,
    ...CreateLogicalModelSelectPermissionStep[],
  ];
};

let mutationBodies: RecordedMetadataMigration[] = [];
let unexpectedRequests: string[] = [];

function metadataHandler(
  readResponse: Record<string, unknown> = hasuraMetadataFixture,
) {
  return http.post(
    'https://local.hasura.local.nhost.run/v1/metadata',
    async ({ request }) => {
      const body = (await request.json()) as { type?: string } | null;

      if (body?.type !== 'export_metadata') {
        unexpectedRequests.push(
          `Local metadata write: ${JSON.stringify(body)}`,
        );
        return HttpResponse.json(
          { error: 'Unexpected local metadata write' },
          { status: 500 },
        );
      }

      await delay(250);
      return HttpResponse.json(readResponse);
    },
  );
}

function migrationHandler(
  response: () => Response | Promise<Response> = () =>
    HttpResponse.json({ name: '0_update_native_query_metadata' }),
) {
  return http.post(
    'https://local.hasura.local.nhost.run/apis/migrate',
    async ({ request }) => {
      mutationBodies.push((await request.json()) as RecordedMetadataMigration);
      return response();
    },
  );
}

const server = setupServer(metadataHandler(), migrationHandler());

interface MetadataResources {
  logicalModels: LogicalModelItem[];
  nativeQueries: NativeQueryItem[];
}

function metadataResourcesHandler({
  logicalModels,
  nativeQueries,
}: MetadataResources) {
  return metadataHandler({
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
}

const logicalModel = (name: string): LogicalModelItem => ({ name, fields: [] });
const nativeQuery = (rootFieldName: string): NativeQueryItem => ({
  root_field_name: rootFieldName,
  code: 'SELECT 1',
  returns: 'alpha_model',
});

type GuardedDrawerSurface =
  | 'create logical model'
  | 'edit logical model'
  | 'create native query'
  | 'edit native query';

const guardedDrawerSurfaces: GuardedDrawerSurface[] = [
  'create logical model',
  'edit native query',
];

async function openGuardedDrawer(
  user: TestUserEvent,
  surface: GuardedDrawerSurface,
) {
  await screen.findByText('search_authors');

  if (surface === 'create logical model') {
    await user.click(screen.getByRole('button', { name: 'New logical model' }));
  } else if (surface === 'create native query') {
    await user.click(screen.getByRole('button', { name: 'New native query' }));
  } else if (surface === 'edit logical model') {
    await user.click(
      screen.getByRole('button', { name: 'Actions for author_result' }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Edit logical model' }),
    );
  } else {
    await user.click(
      screen.getByRole('button', { name: 'Actions for search_authors' }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Edit native query' }),
    );
  }

  return screen.findByLabelText('Description');
}

describe('NativeQueriesBrowserSidebar', () => {
  beforeAll(() => {
    server.listen({
      onUnhandledRequest(request, print) {
        unexpectedRequests.push(`${request.method} ${request.url}`);
        print.error();
      },
    });
    Element.prototype.scrollIntoView = vi.fn();
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  });

  beforeEach(() => {
    mocks.router.query.dataSourceSlug = 'default';
    mocks.routeChangeStart = undefined;
    mocks.router.events.on.mockImplementation(
      (event: string, handler: VoidFunction) => {
        if (event === 'routeChangeStart') {
          mocks.routeChangeStart = handler;
        }
      },
    );
    mocks.router.events.off.mockImplementation(() => {});
    mutationBodies = [];
    unexpectedRequests = [];
  });

  afterEach(() => {
    server.resetHandlers();
    queryClient.clear();
    vi.clearAllMocks();
    act(() => toast.remove());
    expect(unexpectedRequests).toEqual([]);
  });

  afterAll(() => server.close());

  it.each(guardedDrawerSurfaces)(
    'guards dirty Cancel and preserves the %s draft until discard',
    async (surface) => {
      const user = new TestUserEvent();
      render(<NativeQueriesBrowserSidebar />);
      const description = await openGuardedDrawer(user, surface);

      await user.clear(description);
      await user.type(description, `Draft for ${surface}`);
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      const confirmation = await screen.findByRole('dialog', {
        name: 'Unsaved changes',
      });
      await user.click(
        within(confirmation).getByRole('button', { name: 'Cancel' }),
      );
      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: 'Unsaved changes' }),
        ).not.toBeInTheDocument(),
      );
      expect(description).toHaveValue(`Draft for ${surface}`);

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await user.click(
        within(
          await screen.findByRole('dialog', { name: 'Unsaved changes' }),
        ).getByRole('button', { name: 'Discard' }),
      );
      await waitFor(() => expect(description).not.toBeInTheDocument());
    },
  );

  it.each(['edit native query', 'edit logical model'] as const)(
    'keeps a failed %s save dirty and retries the preserved draft',
    async (surface) => {
      server.use(
        migrationHandler(() =>
          HttpResponse.json({ error: 'migration failed' }, { status: 500 }),
        ),
      );
      const user = new TestUserEvent();
      render(<NativeQueriesBrowserSidebar />);
      const description = await openGuardedDrawer(user, surface);
      const save = screen.getByRole('button', { name: 'Save' });

      await user.clear(description);
      await user.type(description, 'Retry this draft');
      await user.click(save);
      await screen.findByText('migration failed');
      expect(mutationBodies).toHaveLength(1);
      expect(description).toHaveValue('Retry this draft');
      expect(save).toBeEnabled();
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      const confirmation = await screen.findByRole('dialog', {
        name: 'Unsaved changes',
      });
      await user.click(
        within(confirmation).getByRole('button', { name: 'Cancel' }),
      );
      await waitFor(() => expect(confirmation).not.toBeInTheDocument());

      server.use(migrationHandler());
      await user.click(save);
      await waitFor(() => expect(description).not.toBeInTheDocument());
      expect(mutationBodies).toHaveLength(2);
      expect(mutationBodies[1]).toEqual(mutationBodies[0]);
    },
  );

  it('renders labelled sections and sorts resources within each section', async () => {
    server.use(
      metadataResourcesHandler({
        nativeQueries: [nativeQuery('zeta_query'), nativeQuery('alpha_query')],
        logicalModels: [
          logicalModel('zeta_model'),
          logicalModel('alpha_model'),
        ],
      }),
    );
    render(<NativeQueriesBrowserSidebar />);

    const queriesSection = await screen.findByRole('region', {
      name: 'Native queries',
    });
    const modelsSection = screen.getByRole('region', {
      name: 'Logical models',
    });
    expect(
      queriesSection.compareDocumentPosition(modelsSection) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await waitFor(() => {
      expect(within(queriesSection).getByText('2')).toBeVisible();
      expect(within(modelsSection).getByText('2')).toBeVisible();
      expect(
        within(queriesSection)
          .getAllByRole('link')
          .map((link) => link.textContent),
      ).toEqual(['alpha_query', 'zeta_query']);
      expect(
        within(modelsSection)
          .getAllByRole('link')
          .map((link) => link.textContent),
      ).toEqual(['alpha_model', 'zeta_model']);
      expect(within(queriesSection).queryByText('alpha_model')).toBeNull();
      expect(within(modelsSection).queryByText('alpha_query')).toBeNull();
    });
  });

  it('filters each section independently and keeps both sections visible', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    const queriesSection = await screen.findByRole('region', {
      name: 'Native queries',
    });
    const modelsSection = screen.getByRole('region', {
      name: 'Logical models',
    });
    const search = screen.getByPlaceholderText('Search objects...');

    await user.type(search, 'search');
    expect(within(queriesSection).getByText('search_authors')).toBeVisible();
    expect(
      within(modelsSection).getByText('No logical models match your search.'),
    ).toBeVisible();

    await user.clear(search);
    await user.type(search, 'collection');
    expect(within(modelsSection).getByText('author_collection')).toBeVisible();
    expect(
      within(queriesSection).getByText('No native queries match your search.'),
    ).toBeVisible();

    await user.clear(search);
    await user.type(search, 'missing');
    expect(
      within(queriesSection).getByText('No native queries match your search.'),
    ).toBeVisible();
    expect(
      within(modelsSection).getByText('No logical models match your search.'),
    ).toBeVisible();
  });

  it('offers logical model creation', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    await screen.findByText('author_result');
    await user.click(screen.getByRole('button', { name: 'New logical model' }));
    expect(screen.getByText('Create logical model')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Field 1 name'), 'id');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Name is required.')).toBeInTheDocument();
    expect(mutationBodies).toHaveLength(0);

    await user.type(screen.getByLabelText('Name'), 'new_result');
    await user.click(
      screen.getByRole('combobox', { name: 'Field 1 scalar type' }),
    );
    await user.click(screen.getByRole('option', { name: 'uuid' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mutationBodies).toHaveLength(1));
    expect(mutationBodies[0].up[0]).toMatchObject({
      type: 'bulk_atomic',
      args: [
        {
          type: 'pg_track_logical_model',
          args: {
            source: 'default',
            name: 'new_result',
            fields: [{ name: 'id', type: { scalar: 'uuid', nullable: false } }],
          },
        },
      ],
    });
    await waitFor(() =>
      expect(screen.queryByLabelText('Name')).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('dialog', { name: 'Unsaved changes' }),
    ).not.toBeInTheDocument();
  });

  it('opens edit from the item menu and submits the existing model', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    await screen.findByText('author_result');
    await user.click(
      screen.getByRole('button', { name: 'Actions for author_result' }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Edit logical model' }),
    );
    expect(screen.getByText(/Edit/)).toBeInTheDocument();
    const description = screen.getByLabelText('Description');
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    await user.clear(description);
    await user.type(description, 'Updated model');
    await user.click(save);

    await waitFor(() => expect(mutationBodies).toHaveLength(1));
    expect(mutationBodies[0]?.name).toBe('update_logical_model_author_result');
    expect(mutationBodies[0]?.up[0]?.args?.[1]).toMatchObject({
      type: 'pg_track_logical_model',
      args: { name: 'author_result', description: 'Updated model' },
    });
    await waitFor(() => expect(description).not.toBeInTheDocument());
    expect(
      screen.queryByRole('dialog', { name: 'Unsaved changes' }),
    ).not.toBeInTheDocument();
  });

  it('opens logical model permissions from the item menu', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    await screen.findByText('author_result');
    await user.click(
      screen.getByRole('button', { name: 'Actions for author_result' }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Edit permissions' }),
    );

    expect(
      await screen.findByText('Roles & Actions overview'),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole('row', { name: 'user Full permission' }),
      ).getByRole('button'),
    ).toBeInTheDocument();
  });

  it('opens native query creation and submits the form', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    await screen.findByText('search_authors');
    await user.click(screen.getByRole('button', { name: 'New native query' }));
    expect(screen.getByText('Create native query')).toBeInTheDocument();

    const rootFieldName = await screen.findByLabelText('Root field name');
    await user.type(rootFieldName, 'list_authors');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('SQL is required.')).toBeInTheDocument();
    expect(mutationBodies).toHaveLength(0);

    await user.type(
      screen.getByLabelText('SQL editor'),
      'SELECT * FROM authors',
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(mutationBodies).toHaveLength(1));
    expect(mutationBodies[0].up[0]).toMatchObject({
      type: 'bulk_atomic',
      args: [
        {
          type: 'pg_track_native_query',
          args: {
            source: 'default',
            root_field_name: 'list_authors',
            type: 'query',
            arguments: {},
            code: 'SELECT * FROM authors',
            returns: 'author_result',
          },
        },
      ],
    });
    await waitFor(() =>
      expect(
        screen.queryByLabelText('Root field name'),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('dialog', { name: 'Unsaved changes' }),
    ).not.toBeInTheDocument();
  });

  it('opens edit and delete flows for native queries', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    await screen.findByText('search_authors');
    await user.click(
      screen.getByRole('button', { name: 'Actions for search_authors' }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Edit native query' }),
    );
    const description = screen.getByLabelText('Description');
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    await user.clear(description);
    await user.type(description, 'Updated query');
    await user.click(save);
    await waitFor(() => expect(mutationBodies).toHaveLength(1));
    expect(mutationBodies[0].up[0].args.map((step) => step.type)).toEqual([
      'pg_untrack_native_query',
      'pg_track_native_query',
    ]);
    await waitFor(() => expect(description).not.toBeInTheDocument());
    expect(
      screen.queryByRole('dialog', { name: 'Unsaved changes' }),
    ).not.toBeInTheDocument();

    mutationBodies = [];
    await user.click(
      screen.getByRole('button', { name: 'Actions for search_authors' }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Delete native query' }),
    );
    expect(screen.getByText('Delete Native Query')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mutationBodies).toHaveLength(1));
    expect(mutationBodies[0].up[0]).toMatchObject({
      type: 'bulk_atomic',
      args: [
        {
          type: 'pg_untrack_native_query',
          args: { source: 'default', root_field_name: 'search_authors' },
        },
      ],
    });
  });

  it('confirms deletion from the logical model item menu', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    await screen.findByText('author_result');
    await user.click(
      screen.getByRole('button', { name: 'Actions for author_result' }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Delete logical model' }),
    );
    expect(screen.getByText('Delete Logical Model')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mutationBodies).toHaveLength(1));
    expect(mutationBodies[0].up[0]).toMatchObject({
      type: 'bulk_atomic',
      args: [
        {
          type: 'pg_untrack_logical_model',
          args: { source: 'default', name: 'author_result' },
        },
      ],
    });
  });
});
