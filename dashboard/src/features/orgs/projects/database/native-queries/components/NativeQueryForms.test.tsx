import { vi } from 'vitest';
import { CreateLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/LogicalModelForms';
import {
  CreateNativeQueryForm,
  EditNativeQueryForm,
} from '@/features/orgs/projects/database/native-queries/components/NativeQueryForms';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
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
  logicalModelMutateAsync: vi.fn(),
}));

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

async function fillNativeQueryDraft(user: TestUserEvent) {
  await user.type(screen.getByLabelText('Root field name'), 'search_authors');
  await user.type(
    screen.getByRole('textbox', { name: 'SQL' }),
    'SELECT * FROM authors',
  );
  await user.click(screen.getByRole('button', { name: 'Add argument' }));
  await user.type(screen.getByLabelText('Argument 1 name'), 'search');
  await user.click(screen.getByRole('combobox', { name: 'Argument 1 type' }));
  await user.click(screen.getByRole('option', { name: 'text' }));
}

const editedQuery: NativeQueryItem = {
  root_field_name: 'authors',
  type: 'query',
  arguments: {},
  code: 'SELECT * FROM authors',
  returns: 'author_result',
};

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
    mocks.nativeMutateAsync.mockReset();
    mocks.nativeMutateAsync.mockResolvedValue({ message: 'success' });
    mocks.logicalModelMutateAsync.mockReset();
    mocks.logicalModelMutateAsync.mockResolvedValue({ message: 'success' });
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
    expect(screen.getByRole('combobox', { name: 'Returns' })).toHaveTextContent(
      'author_result',
    );

    mocks.modelsResult.data = [
      { name: 'author_result' },
      { name: 'book_result' },
    ];
    rerender(<CreateNativeQueryForm />);

    expect(screen.getByLabelText('Root field name')).toHaveValue('draft_name');
    expect(screen.getByRole('combobox', { name: 'Returns' })).toHaveTextContent(
      'author_result',
    );
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

  it('creates a return model with zero models, preserves the draft, and submits the final payload', async () => {
    const user = new TestUserEvent();
    render(<CreateNativeQueryForm />);

    expect(screen.getByLabelText('Returns')).toBeInTheDocument();
    await fillNativeQueryDraft(user);
    await user.click(
      screen.getByRole('button', { name: 'Create logical model' }),
    );

    expect(
      screen.getByRole('heading', { name: 'Logical model' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveFocus();
    expect(screen.queryByLabelText('Root field name')).not.toBeVisible();
    expect(mocks.nativeMutateAsync).not.toHaveBeenCalled();

    await fillLogicalModel(user, 'author_result');
    await user.click(
      screen.getByRole('button', { name: 'Save logical model' }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Native query' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Create logical model' }),
      ).toHaveFocus();
    });
    expect(screen.getByLabelText('Root field name')).toHaveValue(
      'search_authors',
    );
    expect(screen.getByRole('textbox', { name: 'SQL' })).toHaveTextContent(
      'SELECT * FROM authors',
    );
    expect(screen.getByLabelText('Argument 1 name')).toHaveValue('search');
    expect(screen.getByRole('combobox', { name: 'Returns' })).toHaveTextContent(
      'author_result',
    );

    await user.click(screen.getByRole('button', { name: 'Save native query' }));
    await waitFor(() => {
      expect(mocks.nativeMutateAsync).toHaveBeenCalledWith({
        args: expect.objectContaining({
          root_field_name: 'search_authors',
          returns: 'author_result',
          code: 'SELECT * FROM authors',
          arguments: {
            search: expect.objectContaining({ type: 'text', nullable: false }),
          },
        }),
      });
    });
  });

  it('preserves the query draft on Back and creates another model without cross-submission', async () => {
    mocks.modelsResult.data = [{ name: 'author_result' }];
    const user = new TestUserEvent();
    render(<CreateNativeQueryForm />);

    await user.type(screen.getByLabelText('Root field name'), 'draft_name');
    await user.click(
      screen.getByRole('button', { name: 'Create logical model' }),
    );
    await user.type(screen.getByLabelText('Name'), 'unfinished');
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByLabelText('Root field name')).toHaveValue('draft_name');
    expect(
      screen.getByRole('button', { name: 'Create logical model' }),
    ).toHaveFocus();
    expect(mocks.nativeMutateAsync).not.toHaveBeenCalled();
    expect(mocks.logicalModelMutateAsync).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', { name: 'Create logical model' }),
    );
    await fillLogicalModel(user, 'book_result');
    await user.click(
      screen.getByRole('button', { name: 'Save logical model' }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Returns' }),
      ).toHaveTextContent('book_result'),
    );
    expect(screen.getByLabelText('Root field name')).toHaveValue('draft_name');
    expect(mocks.logicalModelMutateAsync).toHaveBeenCalledOnce();
    expect(mocks.nativeMutateAsync).not.toHaveBeenCalled();
  });

  it('retains a failed embedded model form and validates a created duplicate before refetch', async () => {
    const user = new TestUserEvent();
    render(<CreateNativeQueryForm />);

    await user.click(
      screen.getByRole('button', { name: 'Create logical model' }),
    );
    await fillLogicalModel(user, 'author_result');
    mocks.logicalModelMutateAsync.mockRejectedValueOnce(new Error('failed'));
    await user.click(
      screen.getByRole('button', { name: 'Save logical model' }),
    );

    expect(screen.getByLabelText('Name')).toHaveValue('author_result');
    expect(
      screen.getByRole('heading', { name: 'Logical model' }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Save logical model' }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Native query' }),
      ).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole('button', { name: 'Create logical model' }),
    );
    await fillLogicalModel(user, 'author_result');
    await user.click(
      screen.getByRole('button', { name: 'Save logical model' }),
    );

    expect(
      await screen.findByText('A logical model with this name already exists.'),
    ).toBeInTheDocument();
    expect(mocks.logicalModelMutateAsync).toHaveBeenCalledTimes(2);
  });

  it('keeps standalone creation close semantics and hides model creation while editing', async () => {
    const user = new TestUserEvent();
    const onCancel = vi.fn();
    const { unmount } = render(<CreateLogicalModelForm onCancel={onCancel} />);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    await fillLogicalModel(user, 'standalone_result');
    await user.click(
      screen.getByRole('button', { name: 'Save logical model' }),
    );
    await waitFor(() => expect(onCancel).toHaveBeenCalledOnce());
    unmount();

    mocks.modelsResult.data = [{ name: 'author_result' }];
    render(<EditNativeQueryForm query={editedQuery} />);
    expect(
      screen.queryByRole('button', { name: 'Create logical model' }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Root field name')).toHaveValue('authors');
  });
});
