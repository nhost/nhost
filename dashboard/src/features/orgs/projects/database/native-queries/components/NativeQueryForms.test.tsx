import { vi } from 'vitest';
import { CreateLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/LogicalModelForms';
import {
  CreateNativeQueryForm,
  EditNativeQueryForm,
} from '@/features/orgs/projects/database/native-queries/components/NativeQueryForms';
import {
  fireEvent,
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
    },
    push: vi.fn(),
  },
}));

vi.mock('next/router', () => ({ useRouter: () => mocks.router }));
vi.mock('@uiw/react-codemirror', () => ({
  default: ({
    value,
    onChange,
    'aria-label': ariaLabel,
  }: {
    value: string;
    onChange?: (value: string) => void;
    'aria-label'?: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

vi.mock('@/features/orgs/projects/common/hooks/useGetDataSources', () => ({
  useGetDataSources: () => mocks.sourcesResult,
}));
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels',
  () => ({ default: () => mocks.modelsResult }),
);
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useGetNativeQueries',
  () => ({ default: () => mocks.queriesResult }),
);
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation',
  () => ({
    default: () => ({
      mutateAsync: mocks.nativeMutateAsync,
      isPending: false,
    }),
  }),
);
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation',
  () => ({
    default: () => ({
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
    screen.getByRole('combobox', { name: 'Scalar type level 0' }),
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
  await user.type(sql, options.sql ?? 'SELECT * FROM authors');
  await user.click(screen.getByRole('button', { name: 'Add argument' }));
  await user.type(screen.getByLabelText('Argument 1 name'), 'search');
  await user.click(screen.getByRole('combobox', { name: 'Argument 1 type' }));
  await user.click(screen.getByRole('option', { name: 'text' }));
  await user.type(
    screen.getByLabelText('Argument 1 description'),
    'Search phrase',
  );
  await user.click(screen.getByRole('checkbox', { name: 'Nullable' }));
}

function expectNativeQueryDraft(sql = 'SELECT * FROM authors') {
  expect(screen.getByLabelText('Root field name')).toHaveValue(
    'search_authors',
  );
  expect(screen.getByRole('textbox', { name: 'SQL' })).toHaveValue(sql);
  expect(screen.getByLabelText('Argument 1 name')).toHaveValue('search');
  expect(
    screen.getByRole('combobox', { name: 'Argument 1 type' }),
  ).toHaveTextContent('text');
  expect(screen.getByLabelText('Argument 1 description')).toHaveValue(
    'Search phrase',
  );
  expect(screen.getByRole('checkbox', { name: 'Nullable' })).toBeChecked();
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

const editedQuery: NativeQueryItem = {
  root_field_name: 'authors',
  type: 'query',
  arguments: {},
  code: 'SELECT * FROM authors',
  returns: 'author_result',
};

const dismissalMethods = ['Cancel', 'Close', 'Escape', 'Outside'] as const;

describe('NativeQueryForms', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
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
  });

  it('preserves the native-query labels and constrained controls in create and edit forms', () => {
    const { unmount } = render(<CreateNativeQueryForm />);

    expect(screen.getByLabelText('Root field name')).toHaveAttribute(
      'placeholder',
      'root_field_name',
    );
    expect(screen.getByLabelText('Root field name')).toHaveClass('max-w-md');
    expect(
      screen.getByRole('combobox', { name: 'Returns logical model' }),
    ).toHaveClass('flex', 'max-w-md');
    unmount();

    render(<EditNativeQueryForm query={editedQuery} />);

    expect(screen.getByLabelText('Root field name')).toHaveAttribute(
      'placeholder',
      'root_field_name',
    );
    expect(screen.getByLabelText('Root field name')).toHaveClass('max-w-md');
    expect(
      screen.getByRole('combobox', { name: 'Returns logical model' }),
    ).toHaveClass('flex', 'max-w-md');
  });

  it('preserves the standalone logical-model name layout', () => {
    render(<CreateLogicalModelForm />);

    expect(screen.getByLabelText('Name')).toHaveAttribute(
      'placeholder',
      'Logical model name',
    );
    expect(screen.getByLabelText('Name')).toHaveClass('max-w-md');
  });

  it('waits for initial metadata and freezes the first-model default across refetches', async () => {
    mocks.modelsResult.isLoading = true;
    mocks.queriesResult.isLoading = true;
    const { rerender } = render(<CreateNativeQueryForm />);

    expect(
      screen.getByRole('status', { name: 'Loading creation form' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Root field name')).not.toBeInTheDocument();

    mocks.modelsResult.data = [{ name: 'author_result' }];
    mocks.modelsResult.isLoading = false;
    mocks.queriesResult.isLoading = false;
    rerender(<CreateNativeQueryForm />);

    const user = new TestUserEvent();
    await user.type(screen.getByLabelText('Root field name'), 'draft_name');
    expect(
      screen.getByRole('combobox', { name: 'Returns logical model' }),
    ).toHaveTextContent('author_result');

    mocks.modelsResult.data = [
      { name: 'author_result' },
      { name: 'book_result' },
    ];
    rerender(<CreateNativeQueryForm />);

    expect(screen.getByLabelText('Root field name')).toHaveValue('draft_name');
    expect(
      screen.getByRole('combobox', { name: 'Returns logical model' }),
    ).toHaveTextContent('author_result');
  });

  it('shows a closable initial metadata error without mounting the form', async () => {
    const onCancel = vi.fn();
    mocks.modelsResult.error = new Error('failed');
    render(<CreateNativeQueryForm onCancel={onCancel} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Logical models and native queries could not be loaded.',
    );
    expect(screen.queryByLabelText('Root field name')).not.toBeInTheDocument();

    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'Close' }),
    );
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('selects and submits an existing return model from the controlled combobox', async () => {
    mocks.modelsResult.data = [
      { name: 'author_result' },
      { name: 'book_result' },
    ];
    const user = new TestUserEvent();
    render(<CreateNativeQueryForm />);

    expect(
      screen.queryByRole('button', { name: 'Create logical model' }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('combobox', { name: 'Returns logical model' }),
    );
    await user.click(screen.getByRole('option', { name: 'book_result' }));
    await user.type(screen.getByLabelText('Root field name'), 'books');
    await user.type(screen.getByRole('textbox', { name: 'SQL' }), 'SELECT 1');
    await user.click(screen.getByRole('button', { name: 'Save native query' }));

    await waitFor(() =>
      expect(mocks.nativeMutateAsync).toHaveBeenCalledWith({
        args: expect.objectContaining({ returns: 'book_result' }),
      }),
    );
  });

  it('keeps the create action available for empty and unmatched model lists', async () => {
    const user = new TestUserEvent();
    const { rerender } = render(<CreateNativeQueryForm />);

    await user.click(
      screen.getByRole('combobox', { name: 'Returns logical model' }),
    );
    expect(screen.getByText('No logical models found.')).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Create logical model' }),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');

    mocks.modelsResult.data = [{ name: 'author_result' }];
    rerender(<CreateNativeQueryForm />);
    await user.click(
      screen.getByRole('combobox', { name: 'Returns logical model' }),
    );
    await user.type(
      screen.getByPlaceholderText('Search logical models...'),
      'unmatched',
    );
    expect(screen.getByText('No logical models found.')).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Create logical model' }),
    ).toBeInTheDocument();
  });

  it('captures a non-default source in an accessible bounded dialog and creates an immediately selectable return model', async () => {
    mocks.sourcesResult.data = ['default', 'analytics'];
    const user = new TestUserEvent();
    const { rerender } = render(<CreateNativeQueryForm />);

    screen.getByRole('combobox', { name: 'Data Source' }).focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');
    await fillNativeQueryDraft(user);
    await user.click(screen.getByRole('button', { name: 'Save native query' }));

    const returnsTrigger = screen.getByRole('combobox', {
      name: 'Returns logical model',
    });
    expect(returnsTrigger).toHaveAttribute('aria-invalid', 'true');
    expect(returnsTrigger).toHaveAttribute(
      'aria-describedby',
      'native-query-returns-error',
    );

    const dialog = await openLogicalModelDialog(user);

    expect(dialog).toHaveAccessibleDescription(
      'Create the return type for this native query without losing your query draft.',
    );
    expect(dialog).toHaveClass(
      'flex',
      'max-h-[90vh]',
      'max-w-2xl',
      'min-h-0',
      'overflow-hidden',
    );
    const dialogSource = within(dialog).getByRole('combobox', {
      name: 'Data Source',
    });
    expect(dialogSource).toBeDisabled();
    expect(dialogSource).toHaveTextContent('analytics');
    await waitFor(() =>
      expect(within(dialog).getByLabelText('Name')).toHaveFocus(),
    );
    expect(screen.getByLabelText('Root field name')).toHaveValue(
      'search_authors',
    );
    const embeddedRoot = within(dialog).getByText(
      'Define the fields and recursive return types for this model.',
    ).parentElement;
    expect(embeddedRoot).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col');
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    ).toBeInTheDocument();

    const closeButton = within(dialog).getByRole('button', { name: 'Close' });
    closeButton.focus();
    await user.keyboard('{Tab}');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await fillLogicalModel(user, 'analytics_result');
    await user.click(
      within(dialog).getByRole('button', { name: 'Save logical model' }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Create logical model' }),
      ).not.toBeInTheDocument();
      expect(returnsTrigger).toHaveFocus();
    });
    expect(mocks.logicalModelMutateAsync).toHaveBeenCalledWith({
      args: expect.objectContaining({
        source: 'analytics',
        name: 'analytics_result',
      }),
    });
    expect(mocks.nativeMutateAsync).not.toHaveBeenCalled();
    expectNativeQueryDraft();
    expect(returnsTrigger).toHaveTextContent('analytics_result');
    expect(returnsTrigger).toHaveAttribute('aria-invalid', 'false');
    expect(returnsTrigger).not.toHaveAttribute('aria-describedby');
    expect(
      screen.queryByText('Select a return model.'),
    ).not.toBeInTheDocument();

    await user.click(returnsTrigger);
    expect(
      screen.getAllByRole('option', { name: 'analytics_result' }),
    ).toHaveLength(1);
    await user.keyboard('{Escape}');

    mocks.modelsResult.data = [{ name: 'analytics_result' }];
    rerender(<CreateNativeQueryForm />);
    await user.click(returnsTrigger);
    expect(
      screen.getAllByRole('option', { name: 'analytics_result' }),
    ).toHaveLength(1);
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Save native query' }));
    await waitFor(() =>
      expect(mocks.nativeMutateAsync).toHaveBeenCalledWith({
        args: expect.objectContaining({
          source: 'analytics',
          root_field_name: 'search_authors',
          returns: 'analytics_result',
          code: 'SELECT * FROM authors',
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
    await user.click(
      within(dialog).getByRole('button', { name: 'Save logical model' }),
    );

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

    await user.click(screen.getByRole('button', { name: 'Save native query' }));
    await waitFor(() =>
      expect(mocks.nativeMutateAsync).toHaveBeenCalledWith({
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

  it.each(
    dismissalMethods,
  )('dismisses the logical-model dialog with %s, restores focus, and starts clean on reopen', async (method) => {
    mocks.modelsResult.data = [{ name: 'author_result' }];
    const onCancel = vi.fn();
    const user = new TestUserEvent();
    render(<CreateNativeQueryForm onCancel={onCancel} />);

    await fillNativeQueryDraft(user);
    const dialog = await openLogicalModelDialog(user);
    await user.type(within(dialog).getByLabelText('Name'), 'unfinished');

    if (method === 'Cancel' || method === 'Close') {
      await user.click(within(dialog).getByRole('button', { name: method }));
    } else if (method === 'Escape') {
      await user.keyboard('{Escape}');
    } else {
      const backdrop = dialog.parentElement;
      expect(backdrop).not.toBeNull();
      fireEvent.pointerDown(backdrop as HTMLElement, {
        button: 0,
        ctrlKey: false,
        pointerType: 'mouse',
      });
    }

    const returnsTrigger = screen.getByRole('combobox', {
      name: 'Returns logical model',
    });
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Create logical model' }),
      ).not.toBeInTheDocument();
      expect(returnsTrigger).toHaveFocus();
    });
    expect(onCancel).not.toHaveBeenCalled();
    expectNativeQueryDraft();
    expect(returnsTrigger).toHaveTextContent('author_result');

    expect(mocks.logicalModelMutateAsync).not.toHaveBeenCalled();
    expect(mocks.nativeMutateAsync).not.toHaveBeenCalled();

    const reopenedDialog = await openLogicalModelDialog(user);
    expect(within(reopenedDialog).getByLabelText('Name')).toHaveValue('');
    expect(within(reopenedDialog).getByLabelText('Field 1 name')).toHaveValue(
      '',
    );
    await user.click(
      within(reopenedDialog).getByRole('button', { name: 'Cancel' }),
    );
  });

  it('keeps the dialog draft open after client validation errors', async () => {
    const user = new TestUserEvent();
    render(<CreateNativeQueryForm />);

    const dialog = await openLogicalModelDialog(user);
    await user.type(within(dialog).getByLabelText('Name'), 'invalid_result');
    await user.click(
      within(dialog).getByRole('button', { name: 'Save logical model' }),
    );

    expect(
      screen.getByRole('dialog', { name: 'Create logical model' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('invalid_result');
    expect(
      await screen.findByText('Field name is required.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Select or enter a scalar type.'),
    ).toBeInTheDocument();
    expect(mocks.logicalModelMutateAsync).not.toHaveBeenCalled();
  });

  it('keeps the dialog and logical-model draft open after mutation failure', async () => {
    const user = new TestUserEvent();
    mocks.logicalModelMutateAsync.mockRejectedValueOnce(new Error('failed'));
    render(<EditNativeQueryForm query={editedQuery} />);

    const dialog = await openLogicalModelDialog(user);
    await fillLogicalModel(user, 'failed_result');
    await user.click(
      within(dialog).getByRole('button', { name: 'Save logical model' }),
    );

    await waitFor(() =>
      expect(mocks.logicalModelMutateAsync).toHaveBeenCalledOnce(),
    );
    expect(
      screen.getByRole('dialog', { name: 'Create logical model' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('failed_result');
    expect(screen.getByLabelText('Field 1 name')).toHaveValue('id');
    expect(mocks.nativeMutateAsync).not.toHaveBeenCalled();
  });

  it('validates locally created model names before metadata refetches', async () => {
    const user = new TestUserEvent();
    render(<CreateNativeQueryForm />);

    let dialog = await openLogicalModelDialog(user);
    await fillLogicalModel(user, 'author_result');
    await user.click(
      within(dialog).getByRole('button', { name: 'Save logical model' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Create logical model' }),
      ).not.toBeInTheDocument(),
    );

    dialog = await openLogicalModelDialog(user);
    await fillLogicalModel(user, 'author_result');
    await user.click(
      within(dialog).getByRole('button', { name: 'Save logical model' }),
    );

    expect(
      await screen.findByText('A logical model with this name already exists.'),
    ).toBeInTheDocument();
    expect(mocks.logicalModelMutateAsync).toHaveBeenCalledOnce();
  });

  it('keeps logical-model actions below a scrollable fields list', () => {
    render(<CreateLogicalModelForm />);

    const scrollableBody = screen
      .getByLabelText('Field 1 name')
      .closest('.overflow-y-auto');
    const footer = screen.getByRole('button', {
      name: 'Save logical model',
    }).parentElement;

    expect(scrollableBody).toHaveClass(
      'relative',
      'min-h-0',
      'flex-1',
      'overflow-y-auto',
    );
    expect(footer).toHaveClass('shrink-0', 'border-t');
    expect(scrollableBody).not.toContainElement(screen.getByLabelText('Name'));
    expect(scrollableBody).not.toContainElement(
      screen.getByRole('button', { name: 'Save logical model' }),
    );
  });

  it('preserves distinct logical-model array nullability controls', async () => {
    const user = new TestUserEvent();
    render(<CreateLogicalModelForm />);

    screen.getByRole('combobox', { name: 'Type kind level 0' }).focus();
    await user.keyboard('{Enter}{End}{Enter}');

    const arrayNullable = screen.getByRole('checkbox', {
      name: 'Nullable array',
    });
    const itemsNullable = screen.getByRole('checkbox', {
      name: 'Nullable items',
    });

    expect(arrayNullable.tagName).toBe('BUTTON');
    expect(itemsNullable.tagName).toBe('BUTTON');
    expect(arrayNullable).toBeChecked();
    expect(itemsNullable).toBeChecked();

    await user.click(arrayNullable);
    expect(arrayNullable).not.toBeChecked();
    expect(itemsNullable).toBeChecked();
  });

  it('navigates to a newly created standalone logical model', async () => {
    const user = new TestUserEvent();
    const onCancel = vi.fn();
    render(<CreateLogicalModelForm onCancel={onCancel} />);

    await fillLogicalModel(user, 'standalone_result');
    await user.click(
      screen.getByRole('button', { name: 'Save logical model' }),
    );

    await waitFor(() =>
      expect(mocks.router.push).toHaveBeenCalledWith(
        '/orgs/test-org/projects/test-app/database/native-queries/default/models/standalone_result',
      ),
    );
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('keeps standalone cancel and mutation-failure behavior unchanged', async () => {
    const onCancel = vi.fn();
    const user = new TestUserEvent();
    const { unmount } = render(<CreateLogicalModelForm onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(mocks.logicalModelMutateAsync).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
    unmount();

    mocks.logicalModelMutateAsync.mockRejectedValueOnce(new Error('failed'));
    render(<CreateLogicalModelForm />);
    await fillLogicalModel(user, 'failed_result');
    await user.click(
      screen.getByRole('button', { name: 'Save logical model' }),
    );

    await waitFor(() =>
      expect(mocks.logicalModelMutateAsync).toHaveBeenCalledOnce(),
    );
    expect(mocks.router.push).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Name')).toHaveValue('failed_result');
    expect(
      screen.getByRole('button', { name: 'Save logical model' }),
    ).toBeInTheDocument();
  });
});
