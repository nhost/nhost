import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { act } from 'react';
import { toast } from 'react-hot-toast';
import { useDialog } from '@/components/common/DialogProvider';
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
  NativeQueryItem,
} from '@/utils/hasura-api/generated/schemas';

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
  comment: '  Relationship-safe query  ',
  object_relationships: [relationship, unaffectedObjectRelationship],
  array_relationships: [arrayRelationship, unaffectedArrayRelationship],
};
const trackedQuery = {
  ...query,
  source: 'default',
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

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({ project }),
}));
vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: () => false,
}));

interface MetadataBody {
  type?: string;
  resource_version?: number;
  args?: unknown;
}

const metadataBodies: MetadataBody[] = [];
const requestOrder: string[] = [];
const snapshotVersions: number[] = [];
const requestState: {
  exportRequests: number;
  snapshotRequests: number;
  metadataStatus: number;
  exportStatus: number;
  failRefresh: boolean;
  resourceVersion: number;
  deferExport: boolean;
  releaseExport?: VoidFunction;
} = {
  exportRequests: 0,
  snapshotRequests: 0,
  metadataStatus: 200,
  exportStatus: 200,
  failRefresh: false,
  resourceVersion: 40,
  deferExport: false,
};

const server = setupServer(
  http.post(
    'https://local.hasura.local.nhost.run/v1/metadata',
    async ({ request }) => {
      const body = (await request.json()) as MetadataBody;
      if (body.type === 'export_metadata') {
        requestOrder.push('snapshot');
        requestState.snapshotRequests += 1;
        requestState.resourceVersion += 1;
        snapshotVersions.push(requestState.resourceVersion);
        if (requestState.failRefresh && requestState.snapshotRequests >= 2) {
          return HttpResponse.json(
            { error: 'metadata refresh failed' },
            { status: 500 },
          );
        }
        return HttpResponse.json({
          metadata: { version: 3, sources: [] },
          resource_version: requestState.resourceVersion,
        });
      }

      requestOrder.push('metadata');
      metadataBodies.push(body);
      return requestState.metadataStatus === 200
        ? HttpResponse.json({ message: 'success' })
        : HttpResponse.json({ error: 'metadata failed' }, { status: 500 });
    },
  ),
  http.get(
    'https://local.hasura.local.nhost.run/apis/metadata',
    async ({ request }) => {
      requestOrder.push('export');
      requestState.exportRequests += 1;
      expect(new URL(request.url).search).toBe('?export=true');
      if (requestState.deferExport) {
        await new Promise<void>((resolve) => {
          requestState.releaseExport = resolve;
        });
      }
      return requestState.exportStatus === 200
        ? HttpResponse.json({ resource_version: 50, metadata: {} })
        : HttpResponse.json({ error: 'export failed' }, { status: 500 });
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
  version = snapshotVersions.at(-1),
): MetadataBody => ({
  type: 'bulk_atomic',
  resource_version: version,
  args: [
    {
      type: 'pg_untrack_native_query',
      args: { source: 'default', root_field_name: query.root_field_name },
    },
    {
      type: 'pg_track_native_query',
      args: {
        ...trackedQuery,
        object_relationships: nextObjectRelationships,
        array_relationships: nextArrayRelationships,
      },
    },
  ],
});

describe('NativeQueryRelationships', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  });

  beforeEach(() => {
    queryClient.clear();
    metadataBodies.length = 0;
    requestOrder.length = 0;
    snapshotVersions.length = 0;
    requestState.exportRequests = 0;
    requestState.snapshotRequests = 0;
    requestState.metadataStatus = 200;
    requestState.exportStatus = 200;
    requestState.failRefresh = false;
    requestState.resourceVersion = 40;
    requestState.deferExport = false;
    requestState.releaseExport = undefined;
    vi.clearAllMocks();
  });

  afterEach(() => {
    server.resetHandlers();
    queryClient.clear();
    act(() => toast.remove());
  });

  afterAll(() => server.close());

  it('adds through fresh bulk_atomic metadata then one awaited export and preserves all other native query data', async () => {
    requestState.deferExport = true;
    render(
      <NativeQueryRelationships
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

    await waitFor(() => expect(requestState.exportRequests).toBe(1));
    expect(metadataBodies).toEqual([
      expectedOperation([
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
    expect(requestOrder).toEqual(['snapshot', 'metadata', 'export']);
    expect(
      screen.getByRole('heading', { name: 'Create Relationship' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Relationship created.')).not.toBeInTheDocument();

    requestState.releaseExport?.();
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Create Relationship' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Relationship created.')).toBeInTheDocument();
  });

  it('edits through fresh bulk_atomic metadata then one export while changing only the target relationship', async () => {
    render(
      <NativeQueryRelationships
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

    await waitFor(() => expect(metadataBodies).toHaveLength(1));
    expect(metadataBodies).toEqual([
      expectedOperation(
        [{ ...relationship, name: 'lead2' }, unaffectedObjectRelationship],
        query.array_relationships,
        snapshotVersions[0],
      ),
    ]);
    expect(requestOrder.slice(0, 3)).toEqual([
      'snapshot',
      'metadata',
      'export',
    ]);
    expect(requestState.exportRequests).toBe(1);
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Edit Relationship' }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(requestOrder).toEqual([
        'snapshot',
        'metadata',
        'export',
        'snapshot',
      ]),
    );
  });

  it('deletes through fresh bulk_atomic metadata then one export while preserving unaffected relationships', async () => {
    render(
      <NativeQueryRelationships
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
    expect(metadataBodies).toEqual([
      expectedOperation(
        [unaffectedObjectRelationship],
        query.array_relationships,
        snapshotVersions[0],
      ),
    ]);
    expect(requestOrder.slice(0, 3)).toEqual([
      'snapshot',
      'metadata',
      'export',
    ]);
    expect(requestState.exportRequests).toBe(1);
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Delete relationship?' }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(requestOrder).toEqual([
        'snapshot',
        'metadata',
        'export',
        'snapshot',
      ]),
    );
    expect(
      screen.getByRole('heading', { name: 'Relationships' }),
    ).toBeInTheDocument();
  });

  it('fetches a fresh outer resource version for every relationship operation', async () => {
    const view = render(
      <NativeQueryRelationships
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

    expect(metadataBodies.map((body) => body.resource_version)).toEqual([
      41, 43,
    ]);
    expect(requestState.exportRequests).toBe(2);
  });

  it('keeps the relationship form available for retry when metadata fails and never exports', async () => {
    requestState.metadataStatus = 500;
    render(
      <NativeQueryRelationships
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

    expect(await screen.findByText('metadata failed')).toBeInTheDocument();
    expect(requestOrder).toEqual(['snapshot', 'metadata']);
    expect(requestState.exportRequests).toBe(0);
    expect(
      screen.getByRole('heading', { name: 'Create Relationship' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Relationship Name')).toHaveValue('reports');
    expect(screen.queryByText('Relationship created.')).not.toBeInTheDocument();
  });

  it('shows partial-success persistence error, attempts one real refresh, and keeps success UI suppressed even if refresh fails', async () => {
    requestState.exportStatus = 500;
    requestState.failRefresh = true;
    render(
      <NativeQueryRelationships
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
      await screen.findByText(
        'Hasura metadata was updated, but it could not be saved to local metadata files.',
      ),
    ).toBeInTheDocument();
    expect(requestOrder).toEqual([
      'snapshot',
      'metadata',
      'export',
      'snapshot',
    ]);
    expect(requestState.snapshotRequests).toBe(2);
    expect(requestState.exportRequests).toBe(1);
    expect(
      screen.getByRole('heading', { name: 'Delete relationship?' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('manager')).toHaveLength(2);
    expect(screen.queryByText('Relationship deleted.')).not.toBeInTheDocument();
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
      expect(metadataBodies).toHaveLength(0);
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
      expect(metadataBodies).toHaveLength(0);
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
      expect(metadataBodies).toHaveLength(0);
    });
  });
});
