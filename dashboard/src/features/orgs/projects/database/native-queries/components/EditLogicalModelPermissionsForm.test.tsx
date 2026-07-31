import { act } from 'react';
import { toast } from 'react-hot-toast';
import { vi } from 'vitest';
import { useDialog } from '@/components/common/DialogProvider';
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
    {
      role: 'auditor',
      permission: { columns: ['id', 'name'], filter: {} },
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
vi.mock('@/features/orgs/projects/hooks/useCurrentOrg', () => ({
  useCurrentOrg: () => ({ org: { slug: 'test-org' } }),
}));
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({ project: { subdomain: 'test-project' } }),
}));
vi.mock('@/generated/graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/generated/graphql')>();
  return {
    ...actual,
    useGetRemoteAppRolesQuery: () => ({
      data: {
        authRoles: [
          { role: 'user' },
          { role: 'editor' },
          { role: 'viewer' },
          { role: 'auditor' },
          { role: 'auditor' },
          { role: 'admin' },
        ],
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

function DrawerHarness() {
  const { openDrawer } = useDialog();
  return (
    <button
      type="button"
      onClick={() =>
        openDrawer({
          title: 'Logical model permissions',
          component: (
            <EditLogicalModelPermissionsForm logicalModelName={model.name} />
          ),
        })
      }
    >
      Open permissions drawer
    </button>
  );
}

describe('EditLogicalModelPermissionsForm', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.releasePointerCapture = vi.fn();
    Element.prototype.setPointerCapture = vi.fn();
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
    mocks.add.mockReset().mockResolvedValue({ message: 'success' });
    mocks.edit.mockReset().mockResolvedValue({ message: 'success' });
    mocks.delete.mockReset().mockResolvedValue({ message: 'success' });
  });

  afterEach(() => {
    act(() => toast.remove());
  });

  it('renders the shared overview with contextual access states', async () => {
    const user = new TestUserEvent();
    renderForm();

    expect(
      screen.getByRole('heading', { name: 'Roles & Actions overview' }),
    ).toBeInTheDocument();
    expect(screen.getByText('full access')).toBeInTheDocument();
    expect(screen.getByText('partial access')).toBeInTheDocument();
    expect(screen.getByText('no access')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings page' })).toHaveAttribute(
      'href',
      '/orgs/test-org/projects/test-project/settings/roles-and-permissions',
    );

    const adminCell = screen.getByLabelText('admin select: full access');
    expect(adminCell.tagName).toBe('TD');
    expect(
      screen.queryByRole('button', { name: 'admin select: full access' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'viewer select: full access' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'user select: partial access' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'auditor select: partial access' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'editor select: no access' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('auditor')).toHaveLength(1);
    expect(screen.queryByText('admin', { selector: 'button' })).toBeNull();

    await user.click(
      screen.getByRole('button', { name: 'auditor select: partial access' }),
    );
    expect(
      screen.getByRole('heading', { name: 'Selected role & action' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Role:')).toHaveTextContent('auditor');
    const actionSwitcher = screen.getByLabelText('Action:');
    expect(actionSwitcher).toBeDisabled();
    actionSwitcher.focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(actionSwitcher).toHaveTextContent('Select');
    expect(
      screen.getAllByRole('button', { name: 'Deselect All' }),
    ).toHaveLength(1);
    expect(
      screen.queryByRole('button', { name: 'Select All' }),
    ).not.toBeInTheDocument();
  });

  it('switches roles and renders existing column values', async () => {
    const user = new TestUserEvent();
    renderForm();

    expect(screen.getByText('public')).toBeInTheDocument();
    expect(screen.getByText('editor')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: /user select: partial access/i }),
    );
    expect(screen.getByLabelText('Role:')).toHaveTextContent('user');
    expect(screen.getByRole('checkbox', { name: 'id' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'name' })).not.toBeChecked();
    expect(screen.getByLabelText('With custom check')).toBeChecked();
    expect(
      screen.getByRole('button', { name: 'Select All' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Deselect All' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(
      screen.getByRole('button', { name: /viewer select: full access/i }),
    );
    expect(screen.getByRole('checkbox', { name: 'id' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'name' })).toBeChecked();
    expect(screen.getByLabelText('Without any checks')).toBeChecked();
    expect(
      screen.getByRole('button', { name: 'Deselect All' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Select All' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(
      screen.getByRole('button', { name: /editor select: no access/i }),
    );
    expect(screen.getByLabelText('Role:')).toHaveTextContent('editor');
    expect(
      screen.getByRole('button', { name: 'Select All' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Deselect All' }),
    ).not.toBeInTheDocument();
  });

  it('locks a JSON-only filter out of Visual mode and preserves it exactly', async () => {
    const user = new TestUserEvent();
    renderForm();
    await user.click(
      screen.getByRole('button', { name: /user select: partial access/i }),
    );

    const visual = screen.getByRole('button', { name: 'Visual' });
    expect(visual).toBeDisabled();
    expect(visual).toHaveAccessibleDescription(/only be edited in JSON mode/i);
    expect(screen.getByLabelText('Filter JSON')).toHaveValue(
      JSON.stringify(jsonOnlyFilter, null, 2),
    );
    await user.click(visual);
    expect(screen.getByLabelText('Filter JSON')).toHaveValue(
      JSON.stringify(jsonOnlyFilter, null, 2),
    );
  });

  it('uses supported JSON edits as the baseline for later visual edits', async () => {
    const user = new TestUserEvent();
    renderForm();
    await user.click(
      screen.getByRole('button', { name: /editor select: no access/i }),
    );
    await user.click(screen.getByLabelText('With custom check'));
    await user.click(screen.getByRole('button', { name: 'Add check' }));
    await user.click(await screen.findByRole('menuitem', { name: 'id' }));
    await user.click(screen.getByRole('button', { name: 'JSON' }));

    fireEvent.change(screen.getByLabelText('Filter JSON'), {
      target: { value: JSON.stringify({ name: { _eq: 'from JSON' } }) },
    });
    await user.click(screen.getByRole('button', { name: 'Visual' }));

    expect(screen.getByLabelText('Logical model field')).toHaveTextContent(
      'name',
    );
    fireEvent.change(screen.getByLabelText('Logical model value'), {
      target: { value: 'edited visually' },
    });
    await user.click(screen.getByRole('button', { name: 'Select All' }));
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
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
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    const nextFilter = { id: { _eq: 'X-Hasura-User-Id' } };
    fireEvent.change(screen.getByLabelText('Filter JSON'), {
      target: { value: JSON.stringify(nextFilter) },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
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
    await user.click(screen.getByRole('button', { name: 'Select All' }));
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );
    await waitFor(() =>
      expect(mocks.add).toHaveBeenCalledWith({
        args: {
          source: 'default',
          name: model.name,
          role: 'public',
          permission: { columns: '*', filter: {} },
        },
      }),
    );

    await user.click(
      screen.getByRole('button', { name: /user select: partial access/i }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Delete Permissions' }),
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));
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
    expect(screen.queryByLabelText('Role:')).not.toBeInTheDocument();
  });

  it('preserves untouched wildcard and explicit-all representations', async () => {
    const user = new TestUserEvent();
    renderForm();

    await user.click(
      screen.getByRole('button', { name: /viewer select: full access/i }),
    );
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );
    await waitFor(() =>
      expect(mocks.edit).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({
            permission: { columns: '*', filter: {} },
          }),
        }),
      ),
    );

    await user.click(
      screen.getByRole('button', { name: /auditor select: partial access/i }),
    );
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );
    await waitFor(() =>
      expect(mocks.edit).toHaveBeenLastCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({
            permission: { columns: ['id', 'name'], filter: {} },
          }),
        }),
      ),
    );
  });

  it('keeps individual all-selection explicit and converts explicit-all through the bulk toggle', async () => {
    const user = new TestUserEvent();
    renderForm();
    await user.click(
      screen.getByRole('button', { name: /user select: partial access/i }),
    );

    await user.click(screen.getByRole('checkbox', { name: 'name' }));
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );
    await waitFor(() =>
      expect(mocks.edit).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({
            permission: expect.objectContaining({ columns: ['id', 'name'] }),
          }),
        }),
      ),
    );

    await user.click(
      screen.getByRole('button', { name: /auditor select: partial access/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Deselect All' }));
    expect(screen.getByRole('checkbox', { name: 'id' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'name' })).not.toBeChecked();
    expect(
      await screen.findByText('Select at least one field.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Select All' }));
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );
    await waitFor(() =>
      expect(mocks.edit).toHaveBeenLastCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({
            permission: expect.objectContaining({ columns: '*' }),
          }),
        }),
      ),
    );
  });

  it('revalidates bulk deselection after choosing an explicit field', async () => {
    const user = new TestUserEvent();
    renderForm();
    await user.click(
      screen.getByRole('button', { name: /viewer select: full access/i }),
    );

    await user.click(screen.getByRole('button', { name: 'Deselect All' }));
    expect(screen.getByRole('checkbox', { name: 'id' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'name' })).not.toBeChecked();
    expect(
      await screen.findByText('Select at least one field.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'id' }));
    await waitFor(() =>
      expect(
        screen.queryByText('Select at least one field.'),
      ).not.toBeInTheDocument(),
    );
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );
    await waitFor(() =>
      expect(mocks.edit).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({
            permission: { columns: ['id'], filter: {} },
          }),
        }),
      ),
    );
  });

  it('validates an empty field selection and revalidates after choosing a field', async () => {
    const user = new TestUserEvent();
    renderForm();
    await user.click(
      screen.getByRole('button', { name: /public select: no access/i }),
    );

    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );
    expect(
      await screen.findByText('Select at least one field.'),
    ).toBeInTheDocument();
    expect(mocks.add).not.toHaveBeenCalled();

    await user.click(screen.getByRole('checkbox', { name: 'id' }));
    await waitFor(() =>
      expect(
        screen.queryByText('Select at least one field.'),
      ).not.toBeInTheDocument(),
    );
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );
    await waitFor(() =>
      expect(mocks.add).toHaveBeenCalledWith({
        args: {
          source: 'default',
          name: model.name,
          role: 'public',
          permission: { columns: ['id'], filter: {} },
        },
      }),
    );
  });

  it('guards dirty Cancel and confirmed role switching', async () => {
    const user = new TestUserEvent();
    renderForm();
    await user.click(
      screen.getByRole('button', { name: /viewer select: full access/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Deselect All' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText(/unsaved local changes/i)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Unsaved changes' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Role:')).toHaveTextContent('viewer');

    screen.getByLabelText('Role:').focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');
    expect(
      await screen.findByText(/unsaved local changes/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Role:')).toHaveTextContent('auditor'),
    );
  });

  it('keeps the drawer open after a rejected close and closes after confirmation', async () => {
    const user = new TestUserEvent();
    render(<DrawerHarness />);
    await user.click(
      screen.getByRole('button', { name: 'Open permissions drawer' }),
    );
    await user.click(
      await screen.findByRole('button', {
        name: /viewer select: full access/i,
      }),
    );
    await user.click(screen.getByRole('checkbox', { name: 'name' }));

    await user.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(screen.getByText(/unsaved local changes/i)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Unsaved changes' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Role:')).toHaveTextContent('viewer');

    await user.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() =>
      expect(screen.queryByLabelText('Role:')).not.toBeInTheDocument(),
    );
  });

  it('does not delete when confirmation is rejected', async () => {
    const user = new TestUserEvent();
    renderForm();
    await user.click(
      screen.getByRole('button', { name: /viewer select: full access/i }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Delete Permissions' }),
    );
    await user.keyboard('{Escape}');

    expect(mocks.delete).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Role:')).toHaveTextContent('viewer');
  });

  it('keeps dirty close protection after a failed save', async () => {
    const user = new TestUserEvent();
    mocks.edit.mockRejectedValueOnce(new Error('save failed'));
    render(<DrawerHarness />);
    await user.click(
      screen.getByRole('button', { name: 'Open permissions drawer' }),
    );
    await user.click(
      await screen.findByRole('button', {
        name: /viewer select: full access/i,
      }),
    );
    await user.click(screen.getByRole('checkbox', { name: 'name' }));
    fireEvent.submit(
      screen.getByRole('button', { name: 'Save' }).closest('form')!,
    );
    await waitFor(() => expect(mocks.edit).toHaveBeenCalled());

    await user.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(screen.getByText(/unsaved local changes/i)).toBeInTheDocument();
  });

  it('keeps dirty close protection after a failed delete', async () => {
    const user = new TestUserEvent();
    mocks.delete.mockRejectedValueOnce(new Error('delete failed'));
    render(<DrawerHarness />);
    await user.click(
      screen.getByRole('button', { name: 'Open permissions drawer' }),
    );
    await user.click(
      await screen.findByRole('button', {
        name: /viewer select: full access/i,
      }),
    );
    await user.click(screen.getByRole('checkbox', { name: 'name' }));
    await user.click(
      screen.getByRole('button', { name: 'Delete Permissions' }),
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mocks.delete).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Delete permissions' }),
      ).not.toBeInTheDocument(),
    );

    await user.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(screen.getByText(/unsaved local changes/i)).toBeInTheDocument();
  });
});
