import { act } from 'react';
import { toast } from 'react-hot-toast';
import { vi } from 'vitest';
import EditLogicalModelPermissionsForm from '@/features/orgs/projects/database/native-queries/components/EditLogicalModelPermissionsForm';
import {
  fireEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';

const jsonOnlyFilter = {
  _or: [
    { id: { _eq: 'X-Hasura-User-Id' } },
    { profile: { active: { _eq: true } } },
  ],
};
const model: LogicalModelItem = {
  name: 'author_result',
  fields: [
    { name: 'id', type: { scalar: 'uuid', nullable: false } },
    { name: 'name', type: { scalar: 'text', nullable: true } },
  ],
  select_permissions: [
    {
      role: 'user',
      permission: { columns: ['id'], filter: jsonOnlyFilter },
    },
    {
      role: 'viewer',
      permission: { columns: '*', filter: {} },
    },
  ],
};
const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  edit: vi.fn(),
  delete: vi.fn(),
  reset: vi.fn(),
}));

vi.mock('@/features/orgs/hooks/useRemoteApplicationGQLClient', () => ({
  useRemoteApplicationGQLClient: () => ({}),
}));
vi.mock('@/generated/graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/generated/graphql')>();
  return {
    ...actual,
    useGetRemoteAppRolesQuery: () => ({
      data: {
        authRoles: [{ role: 'user' }, { role: 'editor' }, { role: 'viewer' }],
      },
      loading: false,
      error: undefined,
    }),
  };
});
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels',
  () => ({
    default: () => ({ data: [model], isLoading: false, error: undefined }),
  }),
);
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelPermissionMutation',
  () => ({
    default: ({ type }: { type: 'add' | 'edit' | 'delete' }) => ({
      mutateAsync: mocks[type],
      reset: mocks.reset,
      isPending: false,
    }),
  }),
);

function renderForm() {
  return render(
    <EditLogicalModelPermissionsForm logicalModelName={model.name} />,
  );
}

describe('EditLogicalModelPermissionsForm', () => {
  beforeAll(() => {
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
    mocks.add.mockResolvedValue({ message: 'success' });
    mocks.edit.mockResolvedValue({ message: 'success' });
    mocks.delete.mockResolvedValue({ message: 'success' });
  });

  afterEach(() => {
    act(() => toast.remove());
  });

  it('switches roles and renders existing column values', async () => {
    const user = new TestUserEvent();
    renderForm();

    expect(screen.getByText('public')).toBeInTheDocument();
    expect(screen.getByText('editor')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: /user select: partial access/i }),
    );
    expect(screen.getByText('Select permission for user')).toBeInTheDocument();
    expect(
      screen
        .getByText('Selected fields')
        .closest('label')
        ?.querySelector('input'),
    ).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'id' })).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(
      screen.getByRole('button', { name: /viewer select: full access/i }),
    );
    expect(
      screen.getByText('All fields').closest('label')?.querySelector('input'),
    ).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(
      screen.getByRole('button', { name: /editor select: no access/i }),
    );
    expect(
      screen.getByText('Select permission for editor'),
    ).toBeInTheDocument();
  });

  it('round-trips a JSON-only filter through a visual-mode visit unchanged', async () => {
    const user = new TestUserEvent();
    renderForm();
    await user.click(
      screen.getByRole('button', { name: /user select: partial access/i }),
    );

    expect(
      screen.getByText(/only be edited in JSON mode/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'JSON' }));
    expect(screen.getByLabelText('Filter JSON')).toHaveValue(
      JSON.stringify(jsonOnlyFilter, null, 2),
    );
    await user.click(screen.getByRole('button', { name: 'Visual' }));
    await user.click(screen.getByRole('button', { name: 'JSON' }));
    expect(screen.getByLabelText('Filter JSON')).toHaveValue(
      JSON.stringify(jsonOnlyFilter, null, 2),
    );
  });

  it('round-trips visual field conditions to JSON', async () => {
    const user = new TestUserEvent();
    renderForm();
    await user.click(
      screen.getByRole('button', { name: /editor select: no access/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    fireEvent.change(screen.getByLabelText('Filter value 1'), {
      target: { value: '"X-Hasura-User-Id"' },
    });
    await user.click(screen.getByRole('button', { name: 'JSON' }));
    expect(screen.getByLabelText('Filter JSON')).toHaveValue(
      JSON.stringify({ id: { _eq: 'X-Hasura-User-Id' } }, null, 2),
    );
  });

  it('uses supported JSON edits as the baseline for later visual edits', async () => {
    const user = new TestUserEvent();
    renderForm();
    await user.click(
      screen.getByRole('button', { name: /editor select: no access/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Add condition' }));
    await user.click(screen.getByRole('button', { name: 'JSON' }));

    fireEvent.change(screen.getByLabelText('Filter JSON'), {
      target: { value: JSON.stringify({ name: { _eq: 'from JSON' } }) },
    });
    await user.click(screen.getByRole('button', { name: 'Visual' }));

    expect(screen.getByLabelText('Filter field 1')).toHaveValue('name');
    fireEvent.change(screen.getByLabelText('Filter value 1'), {
      target: { value: '"edited visually"' },
    });
    await user.click(screen.getByRole('radio', { name: 'All fields' }));
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save permission' }).closest('form')!,
    );

    await waitFor(() =>
      expect(mocks.add).toHaveBeenCalledWith({
        args: {
          source: 'default',
          name: model.name,
          role: 'editor',
          permission: {
            columns: '*',
            filter: { name: { _eq: 'edited visually' } },
          },
        },
      }),
    );
  });

  it('validates JSON and saves the complete edited permission', async () => {
    const user = new TestUserEvent();
    renderForm();
    await user.click(
      screen.getByRole('button', { name: /user select: partial access/i }),
    );
    await user.click(screen.getByRole('button', { name: 'JSON' }));

    fireEvent.change(screen.getByLabelText('Filter JSON'), {
      target: { value: '{' },
    });
    expect(screen.getByText('Invalid JSON')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save permission' }),
    ).toBeDisabled();

    const nextFilter = { id: { _eq: 'X-Hasura-User-Id' } };
    fireEvent.change(screen.getByLabelText('Filter JSON'), {
      target: { value: JSON.stringify(nextFilter) },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save permission' }).closest('form')!,
    );
    await waitFor(() =>
      expect(mocks.edit).toHaveBeenCalledWith({
        args: {
          source: 'default',
          name: model.name,
          role: 'user',
          permission: { columns: ['id'], filter: nextFilter },
        },
        original: model.select_permissions?.[0].permission,
      }),
    );
  });

  it('creates and deletes permissions and resets to the roles view on reopen', async () => {
    const user = new TestUserEvent();
    const view = renderForm();
    await user.click(
      screen.getByRole('button', { name: /public select: no access/i }),
    );
    await user.click(screen.getByRole('radio', { name: 'All fields' }));
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save permission' }).closest('form')!,
    );
    await waitFor(() => expect(mocks.add).toHaveBeenCalled());

    await user.click(
      screen.getByRole('button', { name: /user select: partial access/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Delete permission' }));
    await waitFor(() =>
      expect(mocks.delete).toHaveBeenCalledWith({
        name: model.name,
        role: 'user',
        original: model.select_permissions?.[0].permission,
      }),
    );

    view.unmount();
    renderForm();
    expect(screen.getByText('public')).toBeInTheDocument();
    expect(
      screen.queryByText('Select permission for user'),
    ).not.toBeInTheDocument();
  });
});
