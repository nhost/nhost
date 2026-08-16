import { useDialog } from '@/components/common/DialogProvider';
import { CreateNativeQueryForm } from '@/features/orgs/projects/database/native-queries/components/CreateNativeQueryForm';
import { EditNativeQueryForm } from '@/features/orgs/projects/database/native-queries/components/EditNativeQueryForm';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  act,
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

vi.mock('@/features/orgs/projects/common/hooks/useGetDataSources', () => ({
  useGetDataSources: () => mocks.sourcesResult,
}));
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

type DismissalMethod = 'Cancel' | 'Close' | 'Escape' | 'Outside';

async function dismissLogicalModelDialog(
  user: TestUserEvent,
  dialog: HTMLElement,
  method: DismissalMethod,
) {
  if (method === 'Cancel' || method === 'Close') {
    await user.click(within(dialog).getByRole('button', { name: method }));
    return;
  }

  if (method === 'Escape') {
    await user.keyboard('{Escape}');
    return;
  }

  const backdrop = dialog.parentElement;
  expect(backdrop).not.toBeNull();
  fireEvent.pointerDown(backdrop as HTMLElement, {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse',
  });
}

const editedQuery: NativeQueryItem = {
  root_field_name: 'authors',
  type: 'query',
  arguments: {},
  code: 'SELECT * FROM authors',
  returns: 'author_result',
};

const dismissalMethods: DismissalMethod[] = [
  'Cancel',
  'Close',
  'Escape',
  'Outside',
];

type SqlDialogDismissalMethod = 'Close' | 'Escape' | 'Outside';

const sqlDialogDismissalMethods: SqlDialogDismissalMethod[] = [
  'Close',
  'Escape',
  'Outside',
];

async function openSqlDialog(user: TestUserEvent) {
  await user.click(screen.getByRole('button', { name: 'Expand SQL editor' }));
  return screen.getByRole('dialog', { name: 'SQL editor' });
}

async function dismissSqlDialog(
  user: TestUserEvent,
  dialog: HTMLElement,
  method: SqlDialogDismissalMethod,
) {
  if (method === 'Close') {
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    return;
  }

  if (method === 'Escape') {
    await user.keyboard('{Escape}');
    return;
  }

  const backdrop = dialog.parentElement;
  expect(backdrop).not.toBeNull();
  fireEvent.pointerDown(backdrop as HTMLElement, {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse',
  });
}

function NativeQueryDrawerHarness() {
  const { openDrawer } = useDialog();

  return (
    <button
      type="button"
      onClick={() =>
        openDrawer({
          title: 'Create native query',
          component: <CreateNativeQueryForm />,
        })
      }
    >
      Open native query drawer
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

describe('CreateNativeQueryForm', () => {
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
  });

  it('navigates to a newly created standalone native query before closing', async () => {
    mocks.modelsResult.data = [{ name: 'author_result' }];
    mocks.sourcesResult.data = ['default', 'analytics'];
    let resolveNavigation!: (value: boolean) => void;
    const navigationPromise = new Promise<boolean>((resolve) => {
      resolveNavigation = resolve;
    });
    mocks.router.push.mockReturnValueOnce(navigationPromise);
    const onCancel = vi.fn();
    const user = new TestUserEvent();
    render(<CreateNativeQueryForm onCancel={onCancel} />);

    screen.getByRole('combobox', { name: 'Data Source' }).focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');
    await fillNativeQueryDraft(user);
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledOnce());
    expect(mocks.router.push).toHaveBeenCalledWith(
      '/orgs/test-org/projects/test-app/database/native-queries/analytics/queries/search_authors',
    );
    expect(onCancel).not.toHaveBeenCalled();

    await act(async () => {
      resolveNavigation(true);
      await navigationPromise;
    });
    await waitFor(() => expect(onCancel).toHaveBeenCalledOnce());
  });

  it('closes a cancelled standalone native query without mutating or navigating', async () => {
    const onCancel = vi.fn();
    render(<CreateNativeQueryForm onCancel={onCancel} />);

    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'Cancel' }),
    );

    expect(onCancel).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'click' }),
    );
    expect(mocks.nativeMutateAsync).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it('keeps a failed standalone native query open with its entered values', async () => {
    mocks.modelsResult.data = [{ name: 'author_result' }];
    mocks.nativeMutateAsync.mockRejectedValueOnce(new Error('failed'));
    const onCancel = vi.fn();
    const user = new TestUserEvent();
    render(<CreateNativeQueryForm onCancel={onCancel} />);

    await fillNativeQueryDraft(user);
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(mocks.nativeMutateAsync).toHaveBeenCalledOnce());
    expect(mocks.router.push).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expectNativeQueryDraft();
  });

  it('preserves the native-query labels and constrained controls in create and edit forms', () => {
    const { unmount } = render(<CreateNativeQueryForm />);

    expect(screen.getByLabelText('Root field name')).toHaveAttribute(
      'placeholder',
      'root_field_name',
    );
    expect(screen.getByLabelText('Root field name')).toHaveClass('max-w-md');
    expect(screen.getByLabelText('Description')).toHaveAttribute(
      'placeholder',
      'Optional native query description',
    );
    expect(screen.getByLabelText('Description')).toHaveClass('max-w-md');
    expect(
      screen.getByRole('combobox', { name: 'Returns logical model' }),
    ).toHaveClass('flex', 'h-10', 'max-w-md');
    expect(
      screen.getByLabelText('Root field name').closest('form')?.parentElement,
    ).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col');
    unmount();

    render(<EditNativeQueryForm query={editedQuery} />);

    expect(screen.getByLabelText('Root field name')).toHaveAttribute(
      'placeholder',
      'root_field_name',
    );
    expect(screen.getByLabelText('Root field name')).toHaveClass('max-w-md');
    expect(screen.getByLabelText('Description')).toHaveAttribute(
      'placeholder',
      'Optional native query description',
    );
    expect(screen.getByLabelText('Description')).toHaveClass('max-w-md');
    expect(
      screen.getByRole('combobox', { name: 'Returns logical model' }),
    ).toHaveClass('flex', 'h-10', 'max-w-md');
    expect(
      screen.getByLabelText('Root field name').closest('form')?.parentElement,
    ).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col');
  });

  it('provides an accessible expanded SQL editor in create and edit forms', async () => {
    const user = new TestUserEvent();
    const view = render(<CreateNativeQueryForm />);

    const createTrigger = screen.getByRole('button', {
      name: 'Expand SQL editor',
    });
    expect(createTrigger).toHaveAttribute('type', 'button');
    expect(createTrigger).toHaveAttribute('title', 'Expand SQL editor');

    const dialog = await openSqlDialog(user);
    expect(dialog).toHaveAccessibleDescription(
      'Edit the SQL for this native query.',
    );
    expect(dialog).toHaveClass(
      'flex',
      'h-[85vh]',
      'min-h-0',
      'w-[90vw]',
      'max-w-[90vw]',
      'flex-col',
      'overflow-hidden',
      'md:w-[90vw]',
    );
    const expandedEditor = within(dialog).getByRole('textbox', {
      name: 'Expanded SQL editor',
    });
    await waitFor(() => expect(expandedEditor).toHaveFocus());

    const closeButton = within(dialog).getByRole('button', { name: 'Close' });
    closeButton.focus();
    await user.keyboard('{Tab}');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await user.click(closeButton);
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'SQL editor' }),
      ).not.toBeInTheDocument();
      expect(createTrigger).toHaveFocus();
    });
    view.unmount();

    render(<EditNativeQueryForm query={editedQuery} />);
    const editTrigger = screen.getByRole('button', {
      name: 'Expand SQL editor',
    });
    expect(editTrigger).toHaveAttribute('type', 'button');
    expect(editTrigger).toHaveAttribute('title', 'Expand SQL editor');

    const editDialog = await openSqlDialog(user);
    expect(
      within(editDialog).getByRole('textbox', {
        name: 'Expanded SQL editor',
      }),
    ).toHaveValue('SELECT * FROM authors');
  });

  it('synchronizes both SQL editors across close and reopen and submits the expanded create value', async () => {
    mocks.modelsResult.data = [{ name: 'author_result' }];
    const user = new TestUserEvent();
    render(<CreateNativeQueryForm />);

    await user.type(screen.getByLabelText('Root field name'), 'authors');
    const inlineEditor = screen.getByRole('textbox', { name: 'SQL' });
    await user.type(inlineEditor, 'SELECT * FROM authors');

    let dialog = await openSqlDialog(user);
    let expandedEditor = within(dialog).getByRole('textbox', {
      name: 'Expanded SQL editor',
    });
    expect(expandedEditor).toHaveValue('SELECT * FROM authors');

    await user.clear(expandedEditor);
    await user.type(expandedEditor, 'SELECT id FROM authors');
    expect(inlineEditor).toHaveValue('SELECT id FROM authors');

    await dismissSqlDialog(user, dialog, 'Close');
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'SQL editor' }),
      ).not.toBeInTheDocument(),
    );

    dialog = await openSqlDialog(user);
    expandedEditor = within(dialog).getByRole('textbox', {
      name: 'Expanded SQL editor',
    });
    expect(expandedEditor).toHaveValue('SELECT id FROM authors');
    await dismissSqlDialog(user, dialog, 'Close');
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'SQL editor' }),
      ).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mocks.nativeMutateAsync).toHaveBeenCalledOnce());
    expect(mocks.nativeMutateAsync).toHaveBeenCalledWith({
      args: expect.objectContaining({
        root_field_name: 'authors',
        code: 'SELECT id FROM authors',
      }),
    });
  });

  it.each(
    sqlDialogDismissalMethods,
  )('closes the SQL dialog with %s and restores focus without a discard flow', async (method) => {
    const user = new TestUserEvent();
    render(<CreateNativeQueryForm />);

    const trigger = screen.getByRole('button', {
      name: 'Expand SQL editor',
    });
    const dialog = await openSqlDialog(user);
    await dismissSqlDialog(user, dialog, method);

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'SQL editor' }),
      ).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
    expect(
      screen.queryByRole('alertdialog', { name: 'Unsaved changes' }),
    ).not.toBeInTheDocument();
  });

  it('keeps SQL validation inline and does not duplicate it in the dialog', async () => {
    const user = new TestUserEvent();
    render(<CreateNativeQueryForm />);

    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('SQL is required.')).toBeInTheDocument();

    const dialog = await openSqlDialog(user);
    expect(screen.getAllByText('SQL is required.')).toHaveLength(1);
    expect(
      within(dialog).queryByText('SQL is required.'),
    ).not.toBeInTheDocument();
  });

  it('closes only the SQL dialog when Escape is pressed inside the native query drawer', async () => {
    const user = new TestUserEvent();
    render(<NativeQueryDrawerHarness />);

    await user.click(
      screen.getByRole('button', { name: 'Open native query drawer' }),
    );
    await screen.findByRole('button', { name: 'Expand SQL editor' });
    await openSqlDialog(user);
    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'SQL editor' }),
      ).not.toBeInTheDocument(),
    );
    await waitOutDrawerTransition();
    expect(
      screen.getByRole('heading', { name: 'Create native query' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Expand SQL editor' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('alertdialog', { name: 'Unsaved changes' }),
    ).not.toBeInTheDocument();
  });

  it('maps a trimmed create description only to metadata comment', async () => {
    mocks.modelsResult.data = [{ name: 'author_result' }];
    const user = new TestUserEvent();
    render(<CreateNativeQueryForm />);

    await user.type(screen.getByLabelText('Root field name'), 'search_authors');
    await user.type(
      screen.getByLabelText('Description'),
      '  Public author search  ',
    );
    await user.type(screen.getByRole('textbox', { name: 'SQL' }), 'SELECT 1');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(mocks.nativeMutateAsync).toHaveBeenCalledOnce());
    const submittedArgs = mocks.nativeMutateAsync.mock.calls[0]?.[0].args;
    expect(submittedArgs).toEqual({
      source: 'default',
      root_field_name: 'search_authors',
      type: 'query',
      arguments: {},
      code: 'SELECT 1',
      returns: 'author_result',
      comment: 'Public author search',
    });
    expect(submittedArgs).not.toHaveProperty('description');
  });

  it('omits a whitespace-only description during create', async () => {
    mocks.modelsResult.data = [{ name: 'author_result' }];
    const user = new TestUserEvent();
    render(<CreateNativeQueryForm />);

    await user.type(screen.getByLabelText('Root field name'), 'search_authors');
    await user.type(screen.getByLabelText('Description'), '   ');
    await user.type(screen.getByRole('textbox', { name: 'SQL' }), 'SELECT 1');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(mocks.nativeMutateAsync).toHaveBeenCalledOnce());
    const submittedArgs = mocks.nativeMutateAsync.mock.calls[0]?.[0].args;
    expect(submittedArgs).not.toHaveProperty('comment');
    expect(submittedArgs).not.toHaveProperty('description');
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
    await user.click(screen.getByRole('button', { name: 'Create' }));

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
    await user.click(screen.getByRole('button', { name: 'Create' }));

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
      'Create the return type for this native query.',
    );
    expect(dialog).toHaveClass(
      'flex',
      'max-h-[90vh]',
      'w-[calc(100vw-2rem)]',
      'max-w-3xl',
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
    const embeddedRoot = dialog.querySelector('form')?.parentElement;
    expect(embeddedRoot).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col');
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    ).toBeInTheDocument();

    const closeButton = within(dialog).getByRole('button', { name: 'Close' });
    closeButton.focus();
    await user.keyboard('{Tab}');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await fillLogicalModel(user, 'analytics_result');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Create logical model' }),
      ).not.toBeInTheDocument();
      expect(returnsTrigger).toHaveFocus();
    });
    expect(
      screen.queryByRole('alertdialog', { name: 'Unsaved changes' }),
    ).not.toBeInTheDocument();
    expect(mocks.logicalModelMutateAsync).toHaveBeenCalledWith({
      args: expect.objectContaining({
        source: 'analytics',
        name: 'analytics_result',
      }),
    });
    expect(mocks.router.push).not.toHaveBeenCalled();
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

    await user.click(screen.getByRole('button', { name: 'Create' }));
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

  it('closes only a field description popover on Escape inside the logical-model dialog', async () => {
    const user = new TestUserEvent();
    render(<CreateNativeQueryForm />);

    const dialog = await openLogicalModelDialog(user);
    const trigger = within(dialog).getByRole('button', {
      name: 'Add description',
    });
    await user.click(trigger);
    expect(screen.getByLabelText('Field 1 description')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(
        screen.queryByLabelText('Field 1 description'),
      ).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
    expect(dialog).toBeInTheDocument();
    expect(
      screen.queryByRole('alertdialog', { name: 'Unsaved changes' }),
    ).not.toBeInTheDocument();
  });

  it.each(
    dismissalMethods,
  )('closes a pristine logical-model dialog with %s without prompting', async (method) => {
    mocks.modelsResult.data = [{ name: 'author_result' }];
    const onCancel = vi.fn();
    const user = new TestUserEvent();
    render(<CreateNativeQueryForm onCancel={onCancel} />);

    const dialog = await openLogicalModelDialog(user);
    await dismissLogicalModelDialog(user, dialog, method);

    const returnsTrigger = screen.getByRole('combobox', {
      name: 'Returns logical model',
    });
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Create logical model' }),
      ).not.toBeInTheDocument();
      expect(returnsTrigger).toHaveFocus();
    });
    expect(
      screen.queryByRole('alertdialog', { name: 'Unsaved changes' }),
    ).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it.each(
    dismissalMethods,
  )('guards a dirty logical-model dialog dismissed with %s and discards only the child draft', async (method) => {
    mocks.modelsResult.data = [{ name: 'author_result' }];
    const onCancel = vi.fn();
    const user = new TestUserEvent();
    render(<CreateNativeQueryForm onCancel={onCancel} />);

    await fillNativeQueryDraft(user);
    let dialog = await openLogicalModelDialog(user);
    let nameInput = within(dialog).getByLabelText('Name');
    await user.type(nameInput, 'unfinished');

    await dismissLogicalModelDialog(user, dialog, method);

    let confirmation = await screen.findByRole('alertdialog', {
      name: 'Unsaved changes',
    });
    expect(document.querySelector('#logical-model-name')).toHaveValue(
      'unfinished',
    );

    await user.click(
      within(confirmation).getByRole('button', { name: 'Cancel' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('alertdialog', { name: 'Unsaved changes' }),
      ).not.toBeInTheDocument(),
    );
    dialog = screen.getByRole('dialog', { name: 'Create logical model' });
    nameInput = within(dialog).getByLabelText('Name');
    expect(nameInput).toHaveValue('unfinished');

    await dismissLogicalModelDialog(user, dialog, method);
    confirmation = await screen.findByRole('alertdialog', {
      name: 'Unsaved changes',
    });
    await user.click(
      within(confirmation).getByRole('button', { name: 'Discard' }),
    );

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
    expect(
      screen.queryByRole('alertdialog', { name: 'Unsaved changes' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the dialog draft dirty and guarded after client validation errors', async () => {
    const user = new TestUserEvent();
    render(<CreateNativeQueryForm />);

    const dialog = await openLogicalModelDialog(user);
    await user.type(within(dialog).getByLabelText('Name'), 'invalid_result');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));

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

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    const confirmation = await screen.findByRole('alertdialog', {
      name: 'Unsaved changes',
    });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('invalid_result');
    await user.click(
      within(confirmation).getByRole('button', { name: 'Cancel' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('alertdialog', { name: 'Unsaved changes' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('validates locally created model names before metadata refetches', async () => {
    const user = new TestUserEvent();
    render(<CreateNativeQueryForm />);

    let dialog = await openLogicalModelDialog(user);
    await fillLogicalModel(user, 'author_result');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Create logical model' }),
      ).not.toBeInTheDocument(),
    );

    dialog = await openLogicalModelDialog(user);
    await fillLogicalModel(user, 'author_result');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));

    expect(
      await screen.findByText('A logical model with this name already exists.'),
    ).toBeInTheDocument();
    expect(mocks.logicalModelMutateAsync).toHaveBeenCalledOnce();
  });
});
