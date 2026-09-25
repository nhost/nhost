import { EditNativeQueryForm } from '@/features/orgs/projects/database/native-queries/components/EditNativeQueryForm';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';
import type { NativeQueryItem } from '@/utils/hasura-api/generated/schemas';

const mocks = vi.hoisted(() => ({
  modelsResult: {
    data: [] as Array<{ name: string }>,
    isLoading: false,
    error: null as Error | null,
  },
  queriesResult: {
    data: [] as Array<{ root_field_name: string }>,
    isLoading: false,
    error: null as Error | null,
  },
  nativeMutateAsync: vi.fn(),
  router: {
    query: {
      orgSlug: 'test-org',
      appSubdomain: 'test-app',
      dataSourceSlug: 'default',
      querySlug: '',
    },
    push: vi.fn(),
    asPath:
      '/orgs/test-org/projects/test-app/database/native-queries/default/queries/authors',
  },
}));

vi.mock('next/router', () => ({ useRouter: () => mocks.router }));
vi.mock('@uiw/react-codemirror', () => ({
  default: ({
    value,
    onChange,
    autoFocus,
    'aria-label': ariaLabel,
  }: {
    value: string;
    onChange?: (value: string) => void;
    autoFocus?: boolean;
    'aria-label'?: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={value}
      // biome-ignore lint/a11y/noAutofocus: Preserve CodeMirror's focus behavior in the test mock.
      autoFocus={autoFocus}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

vi.mock('@/features/orgs/projects/common/hooks/useExportMetadata', () => ({
  EXPORT_METADATA_QUERY_KEY: 'export-metadata',
  useExportMetadata: () => ({
    refetch: async () => ({
      data: {
        resource_version: 1,
        metadata: {
          version: 3,
          sources: ['default'].map((name) => ({
            name,
            kind: 'postgres',
            tables: [],
            native_queries: mocks.queriesResult.data,
            logical_models: mocks.modelsResult.data,
          })),
        },
      },
    }),
  }),
}));
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels',
  async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    useGetLogicalModels: () => mocks.modelsResult,
  }),
);
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useGetNativeQueries',
  async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    useGetNativeQueries: () => mocks.queriesResult,
  }),
);
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation',
  () => ({
    useNativeQueryMetadataMutation: () => ({
      mutateAsync: mocks.nativeMutateAsync,
      isPending: false,
    }),
  }),
);
vi.mock('@/features/orgs/utils/execPromiseWithErrorToast', () => ({
  execPromiseWithErrorToast: async (callback: () => Promise<unknown>) => {
    try {
      return await callback();
    } catch {
      return undefined;
    }
  },
}));

async function openSqlDialog(user: TestUserEvent) {
  await user.click(screen.getByRole('button', { name: 'Expand SQL editor' }));
  return screen.getByRole('dialog', { name: 'SQL editor' });
}

const editedQuery: NativeQueryItem = {
  root_field_name: 'authors',
  type: 'query',
  arguments: {},
  code: 'SELECT * FROM authors',
  returns: 'author_result',
};

describe('EditNativeQueryForm', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  });

  beforeEach(() => {
    mocks.modelsResult.data = [];
    mocks.modelsResult.isLoading = false;
    mocks.modelsResult.error = null;
    mocks.queriesResult.data = [];
    mocks.queriesResult.isLoading = false;
    mocks.queriesResult.error = null;
    mocks.nativeMutateAsync.mockReset();
    mocks.nativeMutateAsync.mockResolvedValue({ message: 'success' });
    mocks.router.push.mockReset();
    mocks.router.push.mockResolvedValue(true);
    mocks.router.query.querySlug = '';
  });

  it('navigates to the renamed query when editing the routed query', async () => {
    mocks.router.query.querySlug = editedQuery.root_field_name;
    mocks.modelsResult.data = [{ name: 'author_result' }];
    const user = new TestUserEvent();
    render(<EditNativeQueryForm query={editedQuery} />);
    await user.clear(screen.getByLabelText('Root field name'));
    await user.type(
      screen.getByLabelText('Root field name'),
      'renamed_authors',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mocks.nativeMutateAsync).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(mocks.router.push).toHaveBeenCalledWith(
        '/orgs/test-org/projects/test-app/database/native-queries/default/queries/renamed_authors',
      ),
    );
  });

  it('does not navigate after renaming a query that is not routed', async () => {
    mocks.router.query.querySlug = 'other_query';
    mocks.modelsResult.data = [{ name: 'author_result' }];
    const user = new TestUserEvent();
    render(<EditNativeQueryForm query={editedQuery} />);
    await user.clear(screen.getByLabelText('Root field name'));
    await user.type(
      screen.getByLabelText('Root field name'),
      'renamed_authors',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mocks.nativeMutateAsync).toHaveBeenCalledOnce());
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it('marks an expanded SQL edit dirty and submits it from the edit form', async () => {
    mocks.modelsResult.data = [{ name: 'author_result' }];
    const user = new TestUserEvent();
    render(<EditNativeQueryForm query={editedQuery} />);

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeDisabled();

    const dialog = await openSqlDialog(user);
    const expandedEditor = within(dialog).getByRole('textbox', {
      name: 'Expanded SQL editor',
    });
    await user.clear(expandedEditor);
    await user.type(expandedEditor, 'SELECT id, name FROM authors');
    expect(
      screen.getByRole('textbox', { name: 'SQL', hidden: true }),
    ).toHaveValue('SELECT id, name FROM authors');

    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(saveButton).toBeEnabled());
    await user.click(saveButton);

    await waitFor(() => expect(mocks.nativeMutateAsync).toHaveBeenCalledOnce());
    expect(mocks.nativeMutateAsync).toHaveBeenCalledWith({
      original: editedQuery,
      args: expect.objectContaining({ code: 'SELECT id, name FROM authors' }),
    });
  });

  it('prefills and independently updates entity and argument descriptions', async () => {
    const describedQuery: NativeQueryItem = {
      ...editedQuery,
      description: '  Existing entity description  ',
      arguments: {
        search: {
          type: 'text',
          nullable: false,
          description: '  Existing argument description  ',
        },
      },
      object_relationships: [
        {
          name: 'author',
          using: {
            column_mapping: { author_id: 'id' },
            insertion_order: null,
            remote_native_query: 'author_by_id',
          },
        },
      ],
      array_relationships: [
        {
          name: 'books',
          using: {
            column_mapping: { id: 'author_id' },
            insertion_order: 'after_parent',
            remote_native_query: 'books_by_author',
          },
        },
      ],
    };
    mocks.modelsResult.data = [{ name: 'author_result' }];
    const user = new TestUserEvent();
    render(<EditNativeQueryForm query={describedQuery} />);

    expect(screen.getByLabelText('Description')).toHaveValue(
      '  Existing entity description  ',
    );
    expect(
      screen.getByRole('button', { name: 'Edit description' }),
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Description'));
    await user.type(
      screen.getByLabelText('Description'),
      '  Updated entity description  ',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mocks.nativeMutateAsync).toHaveBeenCalledOnce());
    expect(mocks.nativeMutateAsync).toHaveBeenCalledWith({
      original: describedQuery,
      args: {
        root_field_name: 'authors',
        type: 'query',
        arguments: {
          search: {
            type: 'text',
            nullable: false,
            description: 'Existing argument description',
          },
        },
        code: 'SELECT * FROM authors',
        returns: 'author_result',
        description: 'Updated entity description',
        object_relationships: describedQuery.object_relationships,
        array_relationships: describedQuery.array_relationships,
      },
    });
  });

  it('omits a cleared description on edit', async () => {
    const describedQuery: NativeQueryItem = {
      ...editedQuery,
      description: 'Stale external description',
    };
    mocks.modelsResult.data = [{ name: 'author_result' }];
    const user = new TestUserEvent();
    render(<EditNativeQueryForm query={describedQuery} />);

    await user.clear(screen.getByLabelText('Description'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mocks.nativeMutateAsync).toHaveBeenCalledOnce());
    const submittedArgs = mocks.nativeMutateAsync.mock.calls[0]?.[0].args;
    expect(submittedArgs).not.toHaveProperty('comment');
    expect(submittedArgs).not.toHaveProperty('description');
  });

  it('omits a whitespace-only description on edit', async () => {
    const describedQuery: NativeQueryItem = {
      ...editedQuery,
      description: 'Stale external description',
    };
    mocks.modelsResult.data = [{ name: 'author_result' }];
    const user = new TestUserEvent();
    render(<EditNativeQueryForm query={describedQuery} />);

    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), '   ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mocks.nativeMutateAsync).toHaveBeenCalledOnce());
    const submittedArgs = mocks.nativeMutateAsync.mock.calls[0]?.[0].args;
    expect(submittedArgs).not.toHaveProperty('comment');
    expect(submittedArgs).not.toHaveProperty('description');
  });
});
