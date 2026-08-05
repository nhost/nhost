import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { act } from 'react';
import { toast } from 'react-hot-toast';
import { vi } from 'vitest';
import NativeQueriesBrowserSidebar from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar/NativeQueriesBrowserSidebar';
import hasuraMetadataQuery from '@/tests/msw/mocks/rest/hasuraMetadataQuery';
import {
  fireEvent,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';
import type {
  LogicalModelItem,
  NativeQueryItem,
} from '@/utils/hasura-api/generated/schemas';

const mocks = vi.hoisted(() => ({
  routeChangeStart: undefined as VoidFunction | undefined,
  mutateAsync: vi.fn(),
  nativeQueryMutateAsync: vi.fn(),
  permissionMutateAsync: vi.fn(),
  reset: vi.fn(),
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
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation',
  () => ({
    default: () => ({
      mutateAsync: mocks.mutateAsync,
      reset: mocks.reset,
      isPending: false,
    }),
  }),
);
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelPermissionMutation',
  () => ({
    default: () => ({
      mutateAsync: mocks.permissionMutateAsync,
      reset: mocks.reset,
      isPending: false,
    }),
  }),
);
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation',
  () => ({
    default: () => ({
      mutateAsync: mocks.nativeQueryMutateAsync,
      reset: mocks.reset,
      isPending: false,
    }),
  }),
);

const server = setupServer(hasuraMetadataQuery);

interface MetadataResources {
  logicalModels: LogicalModelItem[];
  nativeQueries: NativeQueryItem[];
}

function metadataResourcesHandler({
  logicalModels,
  nativeQueries,
}: MetadataResources) {
  return http.post('https://local.hasura.local.nhost.run/v1/metadata', () =>
    HttpResponse.json({
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
    }),
  );
}

const logicalModel = (name: string): LogicalModelItem => ({ name, fields: [] });
const nativeQuery = (rootFieldName: string): NativeQueryItem => ({
  root_field_name: rootFieldName,
  code: 'SELECT 1',
  returns: 'alpha_model',
});

function chooseOption(comboboxName: string, optionName: string) {
  fireEvent.keyDown(screen.getByRole('combobox', { name: comboboxName }), {
    key: 'Enter',
  });
  fireEvent.click(screen.getByRole('option', { name: optionName }));
}

type GuardedDrawerSurface =
  | 'create logical model'
  | 'edit logical model'
  | 'create native query'
  | 'edit native query';

const guardedDrawerSurfaces: GuardedDrawerSurface[] = [
  'create logical model',
  'edit logical model',
  'create native query',
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
    server.listen({ onUnhandledRequest: 'error' });
    Element.prototype.scrollIntoView = vi.fn();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  beforeEach(() => {
    mocks.routeChangeStart = undefined;
    mocks.router.events.on.mockImplementation(
      (event: string, handler: VoidFunction) => {
        if (event === 'routeChangeStart') {
          mocks.routeChangeStart = handler;
        }
      },
    );
    mocks.router.events.off.mockImplementation(() => {});
    mocks.mutateAsync.mockResolvedValue({ message: 'success' });
    mocks.nativeQueryMutateAsync.mockResolvedValue({ message: 'success' });
  });

  afterEach(() => {
    server.resetHandlers();
    queryClient.clear();
    vi.clearAllMocks();
    act(() => toast.remove());
  });

  afterAll(() => server.close());

  it.each(
    guardedDrawerSurfaces,
  )('guards dirty Cancel and preserves the %s draft until discard', async (surface) => {
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
  });

  it.each(
    guardedDrawerSurfaces,
  )('closes a pristine %s drawer without prompting', async (surface) => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);
    const description = await openGuardedDrawer(user, surface);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(description).not.toBeInTheDocument());
    expect(
      screen.queryByRole('dialog', { name: 'Unsaved changes' }),
    ).not.toBeInTheDocument();
  });

  it('guards a dirty drawer backdrop click', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);
    const description = await openGuardedDrawer(user, 'create logical model');
    await user.type(description, 'Dirty backdrop draft');

    const backdrop = document.querySelector('.MuiBackdrop-root');
    expect(backdrop).not.toBeNull();
    await act(async () => {
      fireEvent.click(backdrop as HTMLElement);
    });

    expect(
      await screen.findByRole('dialog', { name: 'Unsaved changes' }),
    ).toBeInTheDocument();
    expect(description).toHaveValue('Dirty backdrop draft');
  });

  it('guards embedded Escape once while preserving the parent drawer draft and guard', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);
    const parentDescription = await openGuardedDrawer(
      user,
      'create native query',
    );
    await user.type(parentDescription, 'Parent native query draft');

    await user.click(
      screen.getByRole('combobox', { name: 'Returns logical model' }),
    );
    await user.click(
      screen.getByRole('option', { name: 'Create logical model' }),
    );
    const embeddedDialog = await screen.findByRole('dialog', {
      name: 'Create logical model',
    });
    const embeddedName = within(embeddedDialog).getByLabelText('Name');
    await user.type(embeddedName, 'Embedded logical model draft');

    await user.keyboard('{Escape}');

    const embeddedConfirmation = await screen.findByRole('alertdialog', {
      name: 'Unsaved changes',
    });
    expect(
      screen.getAllByRole('alertdialog', { name: 'Unsaved changes' }),
    ).toHaveLength(1);
    expect(
      screen.queryByRole('dialog', { name: 'Unsaved changes' }),
    ).not.toBeInTheDocument();
    expect(embeddedConfirmation).toBeVisible();
    expect(embeddedDialog).toBeInTheDocument();
    expect(embeddedName).toHaveValue('Embedded logical model draft');
    expect(parentDescription).toHaveValue('Parent native query draft');

    await user.click(
      within(embeddedConfirmation).getByRole('button', { name: 'Cancel' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('alertdialog', { name: 'Unsaved changes' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('dialog', { name: 'Create logical model' }),
    ).toBeInTheDocument();
    expect(embeddedName).toHaveValue('Embedded logical model draft');

    await user.keyboard('{Escape}');
    await user.click(
      within(
        await screen.findByRole('alertdialog', { name: 'Unsaved changes' }),
      ).getByRole('button', { name: 'Discard' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Create logical model' }),
      ).not.toBeInTheDocument(),
    );
    expect(parentDescription).toHaveValue('Parent native query draft');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    const parentConfirmation = await screen.findByRole('dialog', {
      name: 'Unsaved changes',
    });
    expect(parentDescription).toHaveValue('Parent native query draft');
    await user.click(
      within(parentConfirmation).getByRole('button', { name: 'Cancel' }),
    );
  });

  it('guards a dirty drawer Escape dismissal', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);
    const description = await openGuardedDrawer(user, 'create native query');
    await user.type(description, 'Dirty Escape draft');

    await user.keyboard('{Escape}');

    expect(
      await screen.findByRole('dialog', { name: 'Unsaved changes' }),
    ).toBeInTheDocument();
    expect(description).toHaveValue('Dirty Escape draft');
  });

  it('guards a route change while a drawer form is dirty', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);
    const description = await openGuardedDrawer(user, 'edit logical model');
    await user.clear(description);
    await user.type(description, 'Dirty route draft');

    let routeError: unknown;
    await act(async () => {
      try {
        mocks.routeChangeStart?.();
      } catch (error) {
        routeError = error;
      }
    });
    expect(routeError).toEqual(new Error('Unsaved changes'));

    expect(
      await screen.findByRole('dialog', { name: 'Unsaved changes' }),
    ).toBeInTheDocument();
    expect(description).toHaveValue('Dirty route draft');
  });

  it('keeps a failed native-query save dirty and available for retry', async () => {
    mocks.nativeQueryMutateAsync.mockRejectedValueOnce(new Error('failed'));
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);
    const description = await openGuardedDrawer(user, 'edit native query');
    const save = screen.getByRole('button', { name: 'Save' });

    await user.clear(description);
    await user.type(description, 'Retry this draft');
    await user.click(save);
    await waitFor(() =>
      expect(mocks.nativeQueryMutateAsync).toHaveBeenCalledOnce(),
    );

    expect(description).toHaveValue('Retry this draft');
    expect(save).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      await screen.findByRole('dialog', { name: 'Unsaved changes' }),
    ).toBeInTheDocument();
  });

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
    const queriesHeading = within(queriesSection).getByRole('heading', {
      name: 'Native queries',
    });
    const modelsHeading = within(modelsSection).getByRole('heading', {
      name: 'Logical models',
    });

    expect(
      queriesSection.compareDocumentPosition(modelsSection) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      queriesHeading.querySelector('.lucide-database-search'),
    ).not.toBeInTheDocument();
    expect(
      modelsHeading.querySelector('.lucide-shapes'),
    ).not.toBeInTheDocument();
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

  it('shows a resource-empty message only in the empty section', async () => {
    server.use(
      metadataResourcesHandler({
        nativeQueries: [],
        logicalModels: [logicalModel('author_result')],
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
      within(queriesSection).getByText('No native queries yet.'),
    ).toBeVisible();
    expect(within(modelsSection).getByText('author_result')).toBeVisible();
    expect(within(modelsSection).queryByText(/No logical models/)).toBeNull();
  });

  it('keeps both empty sections and native query creation enabled', async () => {
    server.use(
      metadataResourcesHandler({ nativeQueries: [], logicalModels: [] }),
    );
    render(<NativeQueriesBrowserSidebar />);

    const queriesSection = await screen.findByRole('region', {
      name: 'Native queries',
    });
    const modelsSection = screen.getByRole('region', {
      name: 'Logical models',
    });
    expect(
      within(queriesSection).getByText('No native queries yet.'),
    ).toBeVisible();
    expect(
      within(modelsSection).getByText('No logical models yet.'),
    ).toBeVisible();

    expect(
      screen.getByRole('button', { name: 'New native query' }),
    ).toBeEnabled();
  });

  it('offers logical model creation', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    await screen.findByText('author_result');
    await user.click(screen.getByRole('button', { name: 'New logical model' }));
    expect(screen.getByText('Create logical model')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'author_result' },
    });
    fireEvent.change(screen.getByLabelText('Field 1 name'), {
      target: { value: 'id' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Create' }).closest('form')!,
    );
    expect(
      await screen.findByText('A logical model with this name already exists.'),
    ).toBeInTheDocument();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'new_result' },
    });
    await user.click(
      screen.getByRole('combobox', { name: 'Scalar type level 0' }),
    );
    await user.click(screen.getByRole('option', { name: 'uuid' }));
    fireEvent.submit(
      screen.getByRole('button', { name: 'Create' }).closest('form')!,
    );
    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        args: {
          source: 'default',
          name: 'new_result',
          fields: [
            {
              name: 'id',
              type: { scalar: 'uuid', nullable: true },
            },
          ],
        },
      }),
    );
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

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({ name: 'author_result' }),
        }),
      ),
    );
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

    expect(screen.getByText('Roles & Actions overview')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'user select: full access' }),
    ).toBeInTheDocument();
  });

  it('opens native query creation and submits the form', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    await screen.findByText('search_authors');
    await user.click(screen.getByRole('button', { name: 'New native query' }));
    expect(screen.getByText('Create native query')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Root field name'), {
      target: { value: 'search_authors' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Create' }).closest('form')!,
    );
    expect(
      await screen.findByText(
        'A native query with this root field name already exists.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('SQL is required.')).toBeInTheDocument();
    expect(mocks.nativeQueryMutateAsync).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Root field name'), {
      target: { value: 'list_authors' },
    });
    fireEvent.change(screen.getByLabelText('SQL editor'), {
      target: { value: 'SELECT * FROM authors' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Create' }).closest('form')!,
    );

    await waitFor(() =>
      expect(mocks.nativeQueryMutateAsync).toHaveBeenCalledWith({
        args: {
          source: 'default',
          root_field_name: 'list_authors',
          type: 'query',
          arguments: {},
          code: 'SELECT * FROM authors',
          returns: 'author_result',
        },
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByLabelText('Root field name'),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('dialog', { name: 'Unsaved changes' }),
    ).not.toBeInTheDocument();
  });

  it('opens native query relationships in a drawer without navigating', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    await screen.findByText('search_authors');
    await user.click(
      screen.getByRole('button', { name: 'Actions for search_authors' }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Edit Relationships' }),
    );

    expect(
      screen.getByText('Edit Relationships for', { exact: false }),
    ).toBeInTheDocument();
    expect(await screen.findByText('1 object · 1 array')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Edit relationship featured_author',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('related_authors')).toBeInTheDocument();
    expect(screen.getAllByText('· 1 mapping(s)')).toHaveLength(2);
    expect(mocks.router.push).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Add relationship' }));
    expect(
      screen.getByRole('heading', { name: 'Create relationship' }),
    ).toBeInTheDocument();
    expect(screen.getByText('1 object · 1 array')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Relationship name'), {
      target: { value: 'reports' },
    });
    chooseOption('Target native query', 'search_authors');
    chooseOption('Source field 1', 'id');
    chooseOption('Target field 1', 'id');
    const relationshipForm = screen
      .getByRole('button', { name: 'Save relationship' })
      .closest('form');
    expect(relationshipForm).not.toBeNull();
    if (relationshipForm) {
      fireEvent.submit(relationshipForm);
    }

    await waitFor(() =>
      expect(mocks.nativeQueryMutateAsync).toHaveBeenCalled(),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Create relationship' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByText('Edit Relationships for', { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
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
    await waitFor(() =>
      expect(mocks.nativeQueryMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          original: expect.objectContaining({
            root_field_name: 'search_authors',
          }),
          args: expect.objectContaining({ root_field_name: 'search_authors' }),
        }),
      ),
    );
    await waitFor(() => expect(description).not.toBeInTheDocument());
    expect(
      screen.queryByRole('dialog', { name: 'Unsaved changes' }),
    ).not.toBeInTheDocument();

    mocks.nativeQueryMutateAsync.mockClear();
    await user.click(
      screen.getByRole('button', { name: 'Actions for search_authors' }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Delete native query' }),
    );
    expect(screen.getByText('Delete Native Query')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(mocks.nativeQueryMutateAsync).toHaveBeenCalledWith({
        original: expect.objectContaining({
          root_field_name: 'search_authors',
        }),
      }),
    );
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

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        original: expect.objectContaining({ name: 'author_result' }),
      }),
    );
  });
});
