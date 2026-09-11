import { CreateNativeQueryForm } from '@/features/orgs/projects/database/native-queries/components/CreateNativeQueryForm';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';

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
  sources: ['default'] as string[],
  nativeMutateAsync: vi.fn(),
  logicalModelMutateAsync: vi.fn(),
  router: {
    asPath: '/orgs/test-org/projects/test-app/database/native-queries/default',
    query: {
      orgSlug: 'test-org',
      appSubdomain: 'test-app',
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
  useGetDataSources: () => ({ data: mocks.sources }),
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

async function fillNativeQuery(user: TestUserEvent, name = 'search_authors') {
  await user.type(screen.getByLabelText('Root field name'), name);
  await user.type(
    screen.getByRole('textbox', { name: 'SQL' }),
    'SELECT * FROM authors',
  );
}

async function fillLogicalModel(user: TestUserEvent, name: string) {
  const dialog = screen.getByRole('dialog', { name: 'Create logical model' });
  await user.type(within(dialog).getByLabelText('Name'), name);
  await user.type(within(dialog).getByLabelText('Field 1 name'), 'id');
  await user.click(
    within(dialog).getByRole('combobox', { name: 'Field 1 scalar type' }),
  );
  await user.click(screen.getByRole('option', { name: 'text' }));
}

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
    mocks.sources = ['default'];
    mocks.nativeMutateAsync
      .mockReset()
      .mockResolvedValue({ message: 'success' });
    mocks.logicalModelMutateAsync
      .mockReset()
      .mockResolvedValue({ message: 'success' });
    mocks.router.asPath =
      '/orgs/test-org/projects/test-app/database/native-queries/default';
    mocks.router.push.mockReset().mockResolvedValue(true);
  });

  it('waits for initial metadata without resetting the mounted draft on refetch', async () => {
    mocks.modelsResult.isLoading = true;
    mocks.queriesResult.isLoading = true;
    const { rerender } = render(<CreateNativeQueryForm />);

    expect(
      screen.getByRole('status', { name: 'Loading creation form' }),
    ).toBeInTheDocument();

    mocks.modelsResult.data = [{ name: 'author_result' }];
    mocks.modelsResult.isLoading = false;
    mocks.queriesResult.isLoading = false;
    rerender(<CreateNativeQueryForm />);

    await new TestUserEvent().type(
      screen.getByLabelText('Root field name'),
      'draft_name',
    );
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

  it('builds metadata, navigates, and closes after creation', async () => {
    mocks.modelsResult.data = [{ name: 'author_result' }];
    mocks.sources = ['default', 'analytics'];
    const onCancel = vi.fn();
    const user = new TestUserEvent();
    render(<CreateNativeQueryForm onCancel={onCancel} />);

    const source = screen.getByRole('combobox', { name: 'Data Source' });
    expect(source).toBeEnabled();
    source.focus();
    await user.keyboard('{Enter}{End}{Enter}');
    await user.click(
      screen.getByRole('combobox', { name: 'Returns logical model' }),
    );
    await user.click(screen.getByRole('option', { name: 'author_result' }));
    await fillNativeQuery(user);
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(mocks.nativeMutateAsync).toHaveBeenCalledWith({
        source: 'analytics',
        args: {
          root_field_name: 'search_authors',
          type: 'query',
          arguments: {},
          code: 'SELECT * FROM authors',
          returns: 'author_result',
        },
      }),
    );
    expect(mocks.router.push).toHaveBeenCalledWith(
      '/orgs/test-org/projects/test-app/database/native-queries/analytics/queries/search_authors',
    );
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('creates and selects a return model without losing the parent draft', async () => {
    const user = new TestUserEvent();
    render(<CreateNativeQueryForm />);

    await fillNativeQuery(user);
    const returns = screen.getByRole('combobox', {
      name: 'Returns logical model',
    });
    await user.click(returns);
    await user.click(
      screen.getByRole('option', { name: 'Create logical model' }),
    );

    const dialog = screen.getByRole('dialog', { name: 'Create logical model' });
    await waitFor(() =>
      expect(within(dialog).getByLabelText('Name')).toHaveFocus(),
    );
    expect(
      within(dialog).getByRole('combobox', { name: 'Data Source' }),
    ).toBeDisabled();

    await fillLogicalModel(user, 'author_result');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Create logical model' }),
      ).not.toBeInTheDocument(),
    );
    expect(mocks.logicalModelMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'default' }),
    );
    expect(screen.getByLabelText('Root field name')).toHaveValue(
      'search_authors',
    );
    expect(returns).toHaveTextContent('author_result');
  });

  it('shows a closable metadata error before mounting the form', async () => {
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
});
