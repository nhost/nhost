import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { act } from 'react';
import { toast } from 'react-hot-toast';
import { useDialog } from '@/components/common/DialogProvider';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { NativeQueryRelationships } from '@/features/orgs/projects/database/native-queries/components/NativeQueryRelationships';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  fireEvent,
  queryClient,
  render,
  screen,
  waitFor,
  within,
} from '@/tests/testUtils';
import type {
  LogicalModelItem,
  MigrationRequest,
  NativeQueryAtomicMetadataOperation,
  NativeQueryItem,
  NativeQueryRelationshipUsingTable,
} from '@/utils/hasura-api/generated/schemas';

let selectedSource = 'default';

const relationship = {
  name: 'manager',
  using: {
    column_mapping: { id: 'id' },
    insertion_order: 'after_parent' as const,
    remote_native_query: 'authors',
  },
};
const unaffectedObjectRelationship = {
  name: 'editor',
  using: {
    column_mapping: { id: 'editor_id' },
    insertion_order: 'before_parent' as const,
    remote_native_query: 'authors',
  },
};
const arrayRelationship = {
  name: 'team_members',
  using: {
    column_mapping: { id: 'manager_id' },
    insertion_order: 'after_parent' as const,
    remote_native_query: 'authors',
  },
};
const unaffectedArrayRelationship = {
  name: 'reviewers',
  using: {
    column_mapping: { id: 'reviewer_id' },
    insertion_order: 'before_parent' as const,
    remote_native_query: 'authors',
  },
};
const query: NativeQueryItem = {
  root_field_name: 'authors',
  type: 'query',
  arguments: {
    id: {
      type: 'uuid',
      nullable: false,
      description: '  Identifier argument  ',
    },
  },
  code: 'SELECT id FROM authors WHERE id = {{id}}',
  returns: 'author_model',
  description: '  Relationship-safe query  ',
  object_relationships: [relationship, unaffectedObjectRelationship],
  array_relationships: [arrayRelationship, unaffectedArrayRelationship],
};
const trackedQuery = {
  ...query,
  source: selectedSource,
  type: 'query' as const,
  arguments: query.arguments ?? {},
};
const model: LogicalModelItem = {
  name: 'author_model',
  fields: [{ name: 'id', type: { scalar: 'uuid', nullable: false } }],
};
const project = {
  subdomain: 'local',
  region: { name: 'local', domain: 'nhost.run' },
  config: { hasura: { adminSecret: 'nhost-admin-secret' } },
};

const mocks = vi.hoisted(() => ({ isPlatform: false }));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({ project }),
}));
vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: () => mocks.isPlatform,
}));

interface MetadataBody {
  type?: string;
  resource_version?: number;
  args?: unknown;
}

const metadataBodies: MetadataBody[] = [];
const migrationBodies: MigrationRequest[] = [];
const unexpectedRequests: string[] = [];
const requestOrder: string[] = [];
const requestState: {
  snapshotRequests: number;
  migrationStatus: number;
  resourceVersion: number;
  migrationFinished?: Promise<void>;
} = {
  snapshotRequests: 0,
  migrationStatus: 200,
  resourceVersion: 40,
};

let serverQuery: NativeQueryItem = query;

const metadataResponse = () => ({
  metadata: {
    version: 3,
    sources: [
      {
        name: selectedSource,
        kind: 'postgres',
        native_queries: [serverQuery],
        logical_models: [model],
        tables: [],
      },
    ],
  },
  resource_version: requestState.resourceVersion,
});

const server = setupServer(
  http.post(
    'https://local.hasura.local.nhost.run/v1/metadata',
    async ({ request }) => {
      const body = (await request.json()) as MetadataBody;
      if (body.type === 'export_metadata') {
        requestOrder.push('snapshot');
        requestState.snapshotRequests += 1;
        requestState.resourceVersion += 1;
        return HttpResponse.json(metadataResponse());
      }

      if (!mocks.isPlatform) {
        unexpectedRequests.push(
          `Local metadata write: ${JSON.stringify(body)}`,
        );
        return HttpResponse.json(
          { error: 'Unexpected local metadata write' },
          { status: 500 },
        );
      }
      requestOrder.push('metadata');
      metadataBodies.push(body);
      return HttpResponse.json({ message: 'success' });
    },
  ),
  http.post(
    'https://local.hasura.local.nhost.run/apis/migrate',
    async ({ request }) => {
      requestOrder.push('migration');
      migrationBodies.push((await request.json()) as MigrationRequest);
      await requestState.migrationFinished;
      return requestState.migrationStatus === 200
        ? HttpResponse.json({ name: '0_update_native_query_metadata' })
        : HttpResponse.json({ error: 'migration failed' }, { status: 500 });
    },
  ),
);

const chooseOption = (comboboxName: string, optionName: string) => {
  fireEvent.keyDown(screen.getByRole('combobox', { name: comboboxName }), {
    key: 'Enter',
  });
  fireEvent.click(screen.getByRole('option', { name: optionName }));
};

const fillMapping = () => {
  chooseOption('Target Native Query', 'authors');
  fireEvent.click(screen.getByRole('button', { name: 'Add New Mapping' }));
};

function DrawerHarness() {
  const { openDrawer } = useDialog();
  return (
    <button
      type="button"
      onClick={() =>
        openDrawer({
          title: 'Edit Relationships',
          component: (
            <NativeQueryRelationships
              source={selectedSource}
              query={query}
              queries={[query]}
              models={[model]}
            />
          ),
        })
      }
    >
      Open relationships drawer
    </button>
  );
}

const waitOutDrawerTransition = () =>
  act(
    () =>
      new Promise((resolve) => {
        setTimeout(resolve, 300);
      }),
  );

const expectedOperation = (
  nextObjectRelationships: NativeQueryItem['object_relationships'],
  nextArrayRelationships: NativeQueryItem['array_relationships'] = query.array_relationships,
  version = requestState.resourceVersion,
): NativeQueryAtomicMetadataOperation => ({
  type: 'bulk_atomic',
  resource_version: version,
  args: [
    {
      type: 'pg_untrack_native_query',
      args: { source: selectedSource, root_field_name: query.root_field_name },
    },
    {
      type: 'pg_track_native_query',
      args: {
        ...trackedQuery,
        source: selectedSource,
        object_relationships: nextObjectRelationships,
        array_relationships: nextArrayRelationships,
      },
    },
  ],
});

const expectedMigration = (
  nextObjectRelationships: NativeQueryItem['object_relationships'],
  nextArrayRelationships: NativeQueryItem['array_relationships'] = query.array_relationships,
): MigrationRequest => ({
  name: `update_native_query_${query.root_field_name}`,
  datasource: selectedSource,
  up: [
    {
      type: 'bulk_atomic',
      args: expectedOperation(nextObjectRelationships, nextArrayRelationships)
        .args,
    },
  ],
  down: [
    {
      type: 'bulk_atomic',
      args: [
        {
          type: 'pg_untrack_native_query',
          args: {
            source: selectedSource,
            root_field_name: query.root_field_name,
          },
        },
        {
          type: 'pg_track_native_query',
          args: { ...query, source: selectedSource },
        },
      ],
    },
  ],
});

describe.each([
  'default',
  'analytics',
])('NativeQueryRelationships on %s', (source) => {
  beforeAll(() => {
    server.listen({
      onUnhandledRequest(request, print) {
        unexpectedRequests.push(`${request.method} ${request.url}`);
        print.error();
      },
    });
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  });

  beforeEach(() => {
    selectedSource = source;
    queryClient.clear();
    metadataBodies.length = 0;
    migrationBodies.length = 0;
    unexpectedRequests.length = 0;
    requestOrder.length = 0;
    requestState.snapshotRequests = 0;
    requestState.migrationStatus = 200;
    requestState.resourceVersion = 40;
    requestState.migrationFinished = undefined;
    serverQuery = query;
    queryClient.setQueryData(
      [EXPORT_METADATA_QUERY_KEY, project.subdomain],
      metadataResponse(),
    );
    vi.clearAllMocks();
    mocks.isPlatform = false;
  });

  afterEach(() => {
    server.resetHandlers();
    queryClient.clear();
    act(() => toast.remove());
    expect(unexpectedRequests).toEqual([]);
    if (!mocks.isPlatform) {
      expect(metadataBodies).toEqual([]);
    }
  });

  afterAll(() => server.close());

  it('awaits one atomic migration on add and preserves all other native query data', async () => {
    const completion = Promise.withResolvers<void>();
    requestState.migrationFinished = completion.promise;
    render(
      <NativeQueryRelationships
        source={selectedSource}
        query={query}
        queries={[query]}
        models={[model]}
      />,
    );
    expect(screen.getByText('2 object · 2 array')).toBeInTheDocument();
    expect(screen.getByText('manager')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Relationship' }));
    fireEvent.change(screen.getByLabelText('Relationship Name'), {
      target: { value: '_reports2' },
    });
    fillMapping();
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Create Relationship' })
        .closest('form')!,
    );

    try {
      await waitFor(() => expect(migrationBodies).toHaveLength(1));
      expect(migrationBodies).toEqual([
        expectedMigration([
          relationship,
          unaffectedObjectRelationship,
          {
            name: '_reports2',
            using: {
              column_mapping: { id: 'id' },
              insertion_order: null,
              remote_native_query: 'authors',
            },
          },
        ]),
      ]);
      expect(requestOrder).toEqual(['snapshot', 'snapshot', 'migration']);
      expect(
        screen.getByRole('heading', { name: 'Create Relationship' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Create Relationship' }),
      ).toBeDisabled();
      expect(
        screen.queryByText('Relationship created.'),
      ).not.toBeInTheDocument();
    } finally {
      completion.resolve();
    }
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Create Relationship' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Relationship created.')).toBeInTheDocument();
    await waitFor(() =>
      expect(requestOrder).toEqual([
        'snapshot',
        'snapshot',
        'migration',
        'snapshot',
      ]),
    );
  });

  it.each([
    ['users', 'users'],
    [{ schema: 'auth', name: 'users' }, 'auth.users'],
  ] as [
    NativeQueryRelationshipUsingTable['remote_table'],
    string,
  ][])('renders the table target %j as plain text with editing disabled', (remoteTable, targetLabel) => {
    const getQueryHref = vi.fn((name: string) => `/queries/${name}`);
    const tableRelationship = {
      name: 'owner',
      comment: 'Managed outside the dashboard',
      using: {
        column_mapping: { owner_id: 'id' },
        insertion_order: null,
        remote_table: remoteTable,
      },
    };

    render(
      <NativeQueryRelationships
        source={selectedSource}
        query={{
          ...query,
          object_relationships: [tableRelationship],
          array_relationships: [],
        }}
        queries={[query]}
        models={[model]}
        getQueryHref={getQueryHref}
      />,
    );

    expect(screen.getByText(targetLabel)).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: targetLabel }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edit relationship owner' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Delete relationship owner' }),
    ).toBeEnabled();
    expect(getQueryHref).not.toHaveBeenCalled();
  });

  it('edits through one atomic migration while changing only the target relationship', async () => {
    render(
      <NativeQueryRelationships
        source={selectedSource}
        query={query}
        queries={[query]}
        models={[model]}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit relationship manager' }),
    );
    expect(
      screen.getByRole('combobox', { name: 'Target Native Query' }),
    ).toHaveTextContent('authors');
    fireEvent.change(screen.getByLabelText('Relationship Name'), {
      target: { value: 'lead2' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save Changes' }).closest('form')!,
    );

    await waitFor(() => expect(migrationBodies).toHaveLength(1));
    expect(migrationBodies).toEqual([
      expectedMigration([
        { ...relationship, name: 'lead2' },
        unaffectedObjectRelationship,
      ]),
    ]);
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Edit Relationship' }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(requestOrder).toEqual([
        'snapshot',
        'snapshot',
        'migration',
        'snapshot',
      ]),
    );
  });

  it('deletes through one atomic migration while preserving unaffected relationships', async () => {
    render(
      <NativeQueryRelationships
        source={selectedSource}
        query={query}
        queries={[query]}
        models={[model]}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete relationship manager' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete relationship' }),
    );

    await waitFor(() => expect(migrationBodies).toHaveLength(1));
    expect(migrationBodies).toEqual([
      expectedMigration([unaffectedObjectRelationship]),
    ]);
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Delete relationship?' }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(requestOrder).toEqual([
        'snapshot',
        'snapshot',
        'migration',
        'snapshot',
      ]),
    );
    expect(
      screen.getByRole('heading', { name: 'Relationships' }),
    ).toBeInTheDocument();
  });

  it('rebases the write on relationships added since the page rendered', async () => {
    const externalRelationship = {
      name: 'external',
      using: {
        column_mapping: { id: 'id' },
        insertion_order: null,
        remote_native_query: 'authors',
      },
    };
    serverQuery = {
      ...query,
      object_relationships: [
        ...(query.object_relationships ?? []),
        externalRelationship,
      ],
    };

    render(
      <NativeQueryRelationships
        source={selectedSource}
        query={query}
        queries={[query]}
        models={[model]}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete relationship manager' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete relationship' }),
    );

    await waitFor(() => expect(migrationBodies).toHaveLength(1));
    expect(migrationBodies[0].up).toEqual(
      expectedMigration([unaffectedObjectRelationship, externalRelationship])
        .up,
    );
  });

  it('reports a conflict when the native query no longer exists', async () => {
    serverQuery = { ...query, root_field_name: 'renamed_elsewhere' };

    render(
      <NativeQueryRelationships
        source={selectedSource}
        query={query}
        queries={[query]}
        models={[model]}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete relationship manager' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete relationship' }),
    );

    expect(
      await screen.findByText(/changed since the page loaded/i),
    ).toBeInTheDocument();
    expect(migrationBodies).toEqual([]);
    expect(
      metadataBodies.filter((body) => body.type !== 'export_metadata'),
    ).toEqual([]);
  });

  it('fetches a fresh outer resource version for every platform relationship operation', async () => {
    mocks.isPlatform = true;
    const view = render(
      <NativeQueryRelationships
        source={selectedSource}
        query={query}
        queries={[query]}
        models={[model]}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete relationship manager' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete relationship' }),
    );
    await waitFor(() => expect(metadataBodies).toHaveLength(1));

    view.unmount();
    render(
      <NativeQueryRelationships
        source={selectedSource}
        query={query}
        queries={[query]}
        models={[model]}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete relationship manager' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete relationship' }),
    );
    await waitFor(() => expect(metadataBodies).toHaveLength(2));

    expect(metadataBodies).toEqual([
      expectedOperation(
        [unaffectedObjectRelationship],
        query.array_relationships,
        42,
      ),
      expectedOperation(
        [unaffectedObjectRelationship],
        query.array_relationships,
        45,
      ),
    ]);
    expect(migrationBodies).toEqual([]);
  });

  it('keeps a failed relationship save dirty and retries the preserved draft', async () => {
    requestState.migrationStatus = 500;
    render(
      <NativeQueryRelationships
        source={selectedSource}
        query={query}
        queries={[query]}
        models={[model]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Relationship' }));
    fireEvent.change(screen.getByLabelText('Relationship Name'), {
      target: { value: 'reports' },
    });
    fillMapping();
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Create Relationship' })
        .closest('form')!,
    );

    expect(await screen.findByText('migration failed')).toBeInTheDocument();
    expect(requestOrder).toEqual(['snapshot', 'snapshot', 'migration']);
    expect(migrationBodies).toHaveLength(1);
    expect(
      screen.getByRole('heading', { name: 'Create Relationship' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Relationship Name')).toHaveValue('reports');
    expect(screen.queryByText('Relationship created.')).not.toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Create Relationship' });
    expect(save).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const confirmation = await screen.findByRole('alertdialog', {
      name: 'Unsaved changes',
    });
    fireEvent.click(
      within(confirmation).getByRole('button', { name: 'Cancel' }),
    );
    await waitFor(() => expect(confirmation).not.toBeInTheDocument());

    requestState.migrationStatus = 200;
    fireEvent.submit(save.closest('form')!);
    await waitFor(() =>
      expect(
        screen.queryByLabelText('Relationship Name'),
      ).not.toBeInTheDocument(),
    );
    expect(migrationBodies).toHaveLength(2);
    expect(migrationBodies[1]).toEqual(migrationBodies[0]);
    expect(screen.getByText('Relationship created.')).toBeInTheDocument();
  });

  it('keeps a failed delete confirmation open without success refresh and permits retry', async () => {
    requestState.migrationStatus = 500;
    render(
      <NativeQueryRelationships
        source={selectedSource}
        query={query}
        queries={[query]}
        models={[model]}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete relationship manager' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete relationship' }),
    );

    expect(await screen.findByText('migration failed')).toBeInTheDocument();
    expect(requestOrder).toEqual(['snapshot', 'snapshot', 'migration']);
    expect(requestState.snapshotRequests).toBe(2);
    expect(migrationBodies).toEqual([
      expectedMigration([unaffectedObjectRelationship]),
    ]);
    expect(
      screen.getByRole('heading', { name: 'Delete relationship?' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('manager')).toHaveLength(2);
    expect(screen.queryByText('Relationship deleted.')).not.toBeInTheDocument();
    const deleteButton = screen.getByRole('button', {
      name: 'Delete relationship',
    });
    expect(deleteButton).toBeEnabled();

    requestState.migrationStatus = 200;
    fireEvent.click(deleteButton);
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Delete relationship?' }),
      ).not.toBeInTheDocument(),
    );
    expect(migrationBodies).toHaveLength(2);
    expect(migrationBodies[1]).toEqual(migrationBodies[0]);
    expect(screen.getByText('Relationship deleted.')).toBeInTheDocument();
  });

  it('validates required and relationship names across both collections', async () => {
    const queryWithArrayRelationship: NativeQueryItem = {
      ...query,
      array_relationships: [
        {
          name: 'reports',
          using: {
            column_mapping: { id: 'id' },
            insertion_order: null,
            remote_native_query: 'authors',
          },
        },
      ],
    };
    render(
      <NativeQueryRelationships
        source={selectedSource}
        query={queryWithArrayRelationship}
        queries={[queryWithArrayRelationship]}
        models={[model]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Relationship' }));
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Create Relationship' })
        .closest('form')!,
    );
    expect(
      await screen.findByText('Relationship name is required.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Add at least one field mapping.'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Relationship Name'), {
      target: { value: 'reports' },
    });
    fillMapping();
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Create Relationship' })
        .closest('form')!,
    );
    expect(
      await screen.findByText('A relationship with this name already exists.'),
    ).toBeInTheDocument();
  });

  describe('inside the edit relationships drawer', () => {
    it('closes only the relationship dialog when pressing Escape', async () => {
      render(<DrawerHarness />);
      fireEvent.click(
        screen.getByRole('button', { name: 'Open relationships drawer' }),
      );
      fireEvent.click(
        await screen.findByRole('button', { name: 'Relationship' }),
      );

      fireEvent.keyDown(
        screen.getByRole('dialog', { name: 'Create Relationship' }),
        { key: 'Escape' },
      );

      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: 'Create Relationship' }),
        ).not.toBeInTheDocument(),
      );
      await waitOutDrawerTransition();
      expect(
        screen.getByRole('heading', { name: 'Relationships' }),
      ).toBeInTheDocument();
    });

    it('closes only the delete confirmation when pressing Escape', async () => {
      render(<DrawerHarness />);
      fireEvent.click(
        screen.getByRole('button', { name: 'Open relationships drawer' }),
      );
      fireEvent.click(
        await screen.findByRole('button', {
          name: 'Delete relationship manager',
        }),
      );

      fireEvent.keyDown(
        screen.getByRole('alertdialog', { name: 'Delete relationship?' }),
        { key: 'Escape' },
      );

      await waitFor(() =>
        expect(
          screen.queryByRole('alertdialog', { name: 'Delete relationship?' }),
        ).not.toBeInTheDocument(),
      );
      await waitOutDrawerTransition();
      expect(migrationBodies).toHaveLength(0);
      expect(
        screen.getByRole('heading', { name: 'Relationships' }),
      ).toBeInTheDocument();
    });

    it('keeps the dialog and drawer open when Escape rejects the discard confirmation', async () => {
      render(<DrawerHarness />);
      fireEvent.click(
        screen.getByRole('button', { name: 'Open relationships drawer' }),
      );
      fireEvent.click(
        await screen.findByRole('button', { name: 'Relationship' }),
      );
      const relationshipDialog = screen.getByRole('dialog', {
        name: 'Create Relationship',
      });
      const relationshipName =
        within(relationshipDialog).getByLabelText('Relationship Name');
      fireEvent.change(relationshipName, {
        target: { value: 'draft' },
      });

      fireEvent.keyDown(relationshipDialog, { key: 'Escape' });
      const discardDialog = await screen.findByRole('alertdialog', {
        name: 'Unsaved changes',
      });

      fireEvent.keyDown(discardDialog, { key: 'Escape' });

      await waitFor(() => {
        expect(discardDialog).not.toBeInTheDocument();
        expect(relationshipDialog).toContainElement(
          document.activeElement as HTMLElement,
        );
      });
      await waitOutDrawerTransition();
      expect(relationshipDialog).toBeInTheDocument();
      expect(relationshipName).toHaveValue('draft');
      expect(migrationBodies).toHaveLength(0);
      // The open modal dialog marks the drawer aria-hidden, so query by text.
      expect(screen.getByText('Relationships')).toBeInTheDocument();

      fireEvent.keyDown(relationshipDialog, { key: 'Escape' });
      const secondDiscardDialog = await screen.findByRole('alertdialog', {
        name: 'Unsaved changes',
      });
      expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
      expect(secondDiscardDialog).toBeInTheDocument();
      expect(relationshipDialog).toBeInTheDocument();
      expect(relationshipName).toHaveValue('draft');
      expect(migrationBodies).toHaveLength(0);
    });
  });
});
