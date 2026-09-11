import { EditNativeQueryForm } from '@/features/orgs/projects/database/native-queries/components/EditNativeQueryForm';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  act,
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
  sourcesResult: {
    data: ['default'] as string[],
  },
  nativeMutateAsync: vi.fn(),
  logicalModelMutateAsync: vi.fn(),
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

vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useGetSupportedNativeQuerySources',
  () => ({
    useGetSupportedNativeQuerySources: () => mocks.sourcesResult,
  }),
);
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels',
  () => ({ useGetLogicalModels: () => mocks.modelsResult }),
);
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useGetNativeQueries',
  () => ({ useGetNativeQueries: () => mocks.queriesResult }),
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
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation',
  () => ({
    useLogicalModelMetadataMutation: () => ({
      mutateAsync: mocks.logicalModelMutateAsync,
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

async function fillLogicalModel(user: TestUserEvent, name: string) {
  await user.type(screen.getByLabelText('Name'), name);
  await user.type(screen.getByLabelText('Field 1 name'), 'id');
  await user.click(
    screen.getByRole('combobox', { name: 'Field 1 scalar type' }),
  );
  await user.click(screen.getByRole('option', { name: 'text' }));
}

async function fillNativeQueryDraft(
  user: TestUserEvent,
  options: { replaceExisting?: boolean; sql?: string } = {},
) {
  const rootFieldName = screen.getByLabelText('Root field name');
  const sql = screen.getByRole('textbox', { name: 'SQL' });

  if (options.replaceExisting) {
    await user.clear(rootFieldName);
    await user.clear(sql);
  }

  await user.type(rootFieldName, 'search_authors');
  await user.type(
    screen.getByLabelText('Description'),
    'Search author records',
  );
  await user.type(sql, options.sql ?? 'SELECT * FROM authors');
  await user.click(screen.getByRole('button', { name: 'Add argument' }));
  await user.type(screen.getByLabelText('Argument 1 name'), 'search');
  await user.click(screen.getByRole('combobox', { name: 'Argument 1 type' }));
  await user.click(screen.getByRole('option', { name: 'text' }));
  await user.click(screen.getByRole('button', { name: 'Add description' }));
  await user.type(
    screen.getByLabelText('Argument 1 description'),
    'Search phrase',
  );
  await user.click(
    screen.getByRole('checkbox', { name: 'Argument 1 nullable' }),
  );
}

function expectNativeQueryDraft(sql = 'SELECT * FROM authors') {
  expect(screen.getByLabelText('Root field name')).toHaveValue(
    'search_authors',
  );
  expect(screen.getByLabelText('Description')).toHaveValue(
    'Search author records',
  );
  expect(screen.getByRole('textbox', { name: 'SQL' })).toHaveValue(sql);
  expect(screen.getByLabelText('Argument 1 name')).toHaveValue('search');
  expect(
    screen.getByRole('combobox', { name: 'Argument 1 type' }),
  ).toHaveTextContent('text');
  expect(
    screen.getByRole('button', { name: 'Edit description' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('checkbox', { name: 'Argument 1 nullable' }),
  ).toBeChecked();
}

async function openLogicalModelDialog(user: TestUserEvent) {
  await user.click(
    screen.getByRole('combobox', { name: 'Returns logical model' }),
  );
  await user.click(
    screen.getByRole('option', { name: 'Create logical model' }),
  );
  return screen.getByRole('dialog', { name: 'Create logical model' });
}

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
    mocks.sourcesResult.data = ['default'];
    mocks.nativeMutateAsync.mockReset();
    mocks.nativeMutateAsync.mockResolvedValue({ message: 'success' });
    mocks.logicalModelMutateAsync.mockReset();
    mocks.logicalModelMutateAsync.mockResolvedValue({ message: 'success' });
    mocks.router.push.mockReset();
    mocks.router.push.mockResolvedValue(true);
    mocks.router.query.querySlug = '';
  });

  it.each([
    'authors',
    'other_query',
  ])('navigates after a rename only when editing the routed query (%s)', async (querySlug) => {
    mocks.router.query.querySlug = querySlug;
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
    if (querySlug === editedQuery.root_field_name) {
      await waitFor(() =>
        expect(mocks.router.push).toHaveBeenCalledWith(
          '/orgs/test-org/projects/test-app/database/native-queries/default/queries/renamed_authors',
        ),
      );
    } else {
      expect(mocks.router.push).not.toHaveBeenCalled();
    }
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
      source: 'default',
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
      source: 'default',
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

  it.each([
    ['cleared', ''],
    ['whitespace-only', '   '],
  ])('omits a %s description on edit', async (_, value) => {
    const describedQuery: NativeQueryItem = {
      ...editedQuery,
      description: 'Stale external description',
    };
    mocks.modelsResult.data = [{ name: 'author_result' }];
    const user = new TestUserEvent();
    render(<EditNativeQueryForm query={describedQuery} />);

    await user.clear(screen.getByLabelText('Description'));
    if (value) {
      await user.type(screen.getByLabelText('Description'), value);
    }
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mocks.nativeMutateAsync).toHaveBeenCalledOnce());
    const submittedArgs = mocks.nativeMutateAsync.mock.calls[0]?.[0].args;
    expect(submittedArgs).not.toHaveProperty('comment');
    expect(submittedArgs).not.toHaveProperty('description');
  });

  it('preserves the complete edit draft and selects a created model without cross-submitting', async () => {
    mocks.modelsResult.data = [{ name: 'author_result' }];
    const user = new TestUserEvent();
    render(<EditNativeQueryForm query={editedQuery} />);

    await fillNativeQueryDraft(user, {
      replaceExisting: true,
      sql: 'SELECT * FROM authors WHERE name = $1',
    });
    const dialog = await openLogicalModelDialog(user);
    const dialogSource = within(dialog).getByRole('combobox', {
      name: 'Data Source',
    });
    expect(dialogSource).toBeDisabled();
    expect(dialogSource).toHaveTextContent('default');

    await fillLogicalModel(user, 'new_result');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));

    const returnsTrigger = screen.getByRole('combobox', {
      name: 'Returns logical model',
    });
    await waitFor(() => {
      expect(returnsTrigger).toHaveTextContent('new_result');
      expect(returnsTrigger).toHaveFocus();
    });
    expect(mocks.nativeMutateAsync).not.toHaveBeenCalled();
    expectNativeQueryDraft('SELECT * FROM authors WHERE name = $1');
    await user.click(returnsTrigger);
    expect(
      screen.getByRole('option', { name: 'new_result' }),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(mocks.nativeMutateAsync).toHaveBeenCalledWith({
        source: 'default',
        original: editedQuery,
        args: expect.objectContaining({
          root_field_name: 'search_authors',
          returns: 'new_result',
          code: 'SELECT * FROM authors WHERE name = $1',
          arguments: {
            search: expect.objectContaining({
              type: 'text',
              nullable: true,
              description: 'Search phrase',
            }),
          },
        }),
      }),
    );
  });

  it('keeps the dialog and logical-model draft dirty after mutation failure', async () => {
    const user = new TestUserEvent();
    mocks.logicalModelMutateAsync.mockRejectedValueOnce(new Error('failed'));
    render(<EditNativeQueryForm query={editedQuery} />);

    const dialog = await openLogicalModelDialog(user);
    await fillLogicalModel(user, 'failed_result');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(mocks.logicalModelMutateAsync).toHaveBeenCalledOnce(),
    );
    expect(
      screen.getByRole('dialog', { name: 'Create logical model' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('failed_result');
    expect(screen.getByLabelText('Field 1 name')).toHaveValue('id');
    expect(mocks.nativeMutateAsync).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    const confirmation = await screen.findByRole('alertdialog', {
      name: 'Unsaved changes',
    });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('failed_result');
    await user.click(
      within(confirmation).getByRole('button', { name: 'Cancel' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('alertdialog', { name: 'Unsaved changes' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('keeps a newer same-route draft when an earlier edit response succeeds', async () => {
    mocks.modelsResult.data = [{ name: 'author_result' }];
    const completion = Promise.withResolvers<{ message: string }>();
    mocks.nativeMutateAsync.mockReturnValueOnce(completion.promise);
    const onCancel = vi.fn();
    const user = new TestUserEvent();
    render(<EditNativeQueryForm query={editedQuery} onCancel={onCancel} />);

    await user.type(screen.getByRole('textbox', { name: 'SQL' }), ' LIMIT 10');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.nativeMutateAsync).toHaveBeenCalledOnce());
    await user.type(screen.getByRole('textbox', { name: 'SQL' }), ' OFFSET 1');

    await act(async () => {
      completion.resolve({ message: 'success' });
      await completion.promise;
    });

    expect(screen.getByRole('textbox', { name: 'SQL' })).toHaveValue(
      'SELECT * FROM authors LIMIT 10 OFFSET 1',
    );
    expect(mocks.router.push).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('ignores an edit response after the active query is replaced on the same route', async () => {
    mocks.modelsResult.data = [{ name: 'author_result' }];
    const completion = Promise.withResolvers<{ message: string }>();
    mocks.nativeMutateAsync.mockReturnValueOnce(completion.promise);
    const onCancel = vi.fn();
    const user = new TestUserEvent();
    const view = render(
      <EditNativeQueryForm query={editedQuery} onCancel={onCancel} />,
    );

    await user.type(screen.getByRole('textbox', { name: 'SQL' }), ' LIMIT 10');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.nativeMutateAsync).toHaveBeenCalledOnce());
    view.rerender(
      <EditNativeQueryForm
        query={{ ...editedQuery, description: 'Refreshed definition' }}
        onCancel={onCancel}
      />,
    );

    await act(async () => {
      completion.resolve({ message: 'success' });
      await completion.promise;
    });

    expect(screen.getByRole('textbox', { name: 'SQL' })).toHaveValue(
      'SELECT * FROM authors LIMIT 10',
    );
    expect(mocks.router.push).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
