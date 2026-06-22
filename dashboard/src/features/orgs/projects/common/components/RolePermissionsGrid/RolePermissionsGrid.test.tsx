import { vi } from 'vitest';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import type { RolePermissionRow } from './RolePermissionsGrid';
import RolePermissionsGrid from './RolePermissionsGrid';

const baseRows: RolePermissionRow[] = [
  { role: 'admin', access: 'allowed', hasPermission: true, interactive: false },
  { role: 'public', access: 'allowed', hasPermission: true },
  { role: 'user', access: 'not-allowed', hasPermission: false },
  { role: 'partial-role', access: 'partial', hasPermission: true },
];

function renderGrid(
  props?: Partial<React.ComponentProps<typeof RolePermissionsGrid>>,
) {
  const onExpandedRoleChange = vi.fn();
  const onToggle = vi.fn();
  render(
    <RolePermissionsGrid
      rows={baseRows}
      expandedRole={null}
      onExpandedRoleChange={onExpandedRoleChange}
      onToggle={onToggle}
      {...props}
    />,
  );
  return { onExpandedRoleChange, onToggle };
}

describe('RolePermissionsGrid', () => {
  it('renders the correct icon per access state', () => {
    renderGrid();
    expect(screen.getAllByLabelText('Full permission')).toHaveLength(2);
    expect(screen.getByLabelText('No permission')).toBeInTheDocument();
    expect(screen.getByLabelText('Partial permission')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('renders a static row (no toggle button) for non-interactive rows', () => {
    renderGrid({ rows: [baseRows[0]] });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Full permission')).toBeInTheDocument();
  });

  it('calls onExpandedRoleChange when an interactive row is clicked', async () => {
    const { onExpandedRoleChange } = renderGrid();
    const user = new TestUserEvent();

    const userRow = screen.getByText('user').closest('div');
    const trigger = userRow!.querySelector('button');
    await user.click(trigger!);

    expect(onExpandedRoleChange).toHaveBeenCalledWith('user');
  });

  it('shows the confirm panel with "Allow" and grants when not yet permitted', async () => {
    const { onToggle } = renderGrid({ expandedRole: 'user' });
    const user = new TestUserEvent();

    const allowButton = screen.getByRole('button', { name: 'Allow' });
    await user.click(allowButton);

    expect(onToggle).toHaveBeenCalledWith('user', true);
  });

  it('shows "Delete Permissions" and revokes when already permitted', async () => {
    const { onToggle } = renderGrid({ expandedRole: 'public' });
    const user = new TestUserEvent();

    const deleteButton = screen.getByRole('button', {
      name: 'Delete Permissions',
    });
    await user.click(deleteButton);

    expect(onToggle).toHaveBeenCalledWith('public', false);
  });

  it('renders the confirm description', () => {
    renderGrid({
      expandedRole: 'user',
      rows: [
        {
          role: 'user',
          access: 'not-allowed',
          hasPermission: false,
          confirmDescription: 'Custom description for user',
        },
      ],
    });

    expect(screen.getByText('Custom description for user')).toBeInTheDocument();
  });

  it('disables the confirm buttons while mutating', () => {
    renderGrid({ expandedRole: 'user', isMutating: true });

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
