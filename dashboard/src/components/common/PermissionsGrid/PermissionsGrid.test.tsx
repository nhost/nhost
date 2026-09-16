import { vi } from 'vitest';
import type { DatabaseAction } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { render, screen } from '@/tests/testUtils';
import type { AccessLevel } from './PermissionsGrid';
import PermissionsGrid from './PermissionsGrid';

const ALL_ACTIONS: DatabaseAction[] = ['insert', 'select', 'update', 'delete'];

const defaultLabels: Record<DatabaseAction, string> = {
  insert: 'Insert',
  select: 'Select',
  update: 'Update',
  delete: 'Delete',
};

function renderGrid({
  roles = ['public'],
  actions = ALL_ACTIONS,
  actionLabels = defaultLabels,
  getAccessLevel = () => 'none' as const,
  onSelect = vi.fn(),
}: Partial<{
  roles: string[];
  actions: DatabaseAction[];
  actionLabels: Record<DatabaseAction, string>;
  getAccessLevel: (role: string, action: DatabaseAction) => AccessLevel;
  onSelect: (role: string, action: DatabaseAction) => void;
}> = {}) {
  return render(
    <PermissionsGrid
      roles={roles}
      actions={actions}
      actionLabels={actionLabels}
      getAccessLevel={getAccessLevel}
      onSelect={onSelect}
    />,
  );
}

describe('PermissionsGrid', () => {
  it('should render column headers for each action', () => {
    renderGrid({ actions: ['select', 'insert'] });

    expect(
      screen.getByRole('columnheader', { name: 'Select' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Insert' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Role' }),
    ).toBeInTheDocument();
  });

  it('should render the admin row with full permission icons and no buttons', () => {
    renderGrid({ roles: [] });

    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Full permission')).toHaveLength(4);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('should render role names', () => {
    renderGrid({ roles: ['public', 'editor'] });

    expect(screen.getByText('public')).toBeInTheDocument();
    expect(screen.getByText('editor')).toBeInTheDocument();
  });

  it('should render the correct icon for each access level', () => {
    const accessLevels: Record<string, Record<DatabaseAction, AccessLevel>> = {
      user: {
        insert: 'full',
        select: 'partial',
        update: 'none',
        delete: 'full',
      },
    };

    renderGrid({
      roles: ['user'],
      getAccessLevel: (role, action) => accessLevels[role]?.[action] ?? 'none',
    });

    // 4 from admin row + 2 from user row (insert + delete)
    expect(screen.getAllByLabelText('Full permission')).toHaveLength(6);
    expect(screen.getAllByLabelText('Partial permission')).toHaveLength(1);
    expect(screen.getAllByLabelText('No permission')).toHaveLength(1);
  });

  it('should render only the specified actions', () => {
    renderGrid({ roles: ['user'], actions: ['select'] });

    const columnHeaders = screen.getAllByRole('columnheader');
    expect(columnHeaders).toHaveLength(2);

    expect(
      screen.getByRole('columnheader', { name: 'Select' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'Insert' }),
    ).not.toBeInTheDocument();
  });

  it('should call onSelect with the correct role and action when a cell is clicked', () => {
    const onSelect = vi.fn();

    renderGrid({
      roles: ['public', 'editor'],
      actions: ['select', 'insert'],
      onSelect,
    });

    const buttons = screen.getAllByRole('button');
    // 2 roles × 2 actions = 4 buttons
    expect(buttons).toHaveLength(4);

    buttons[0].click();
    expect(onSelect).toHaveBeenCalledWith('public', 'select');

    buttons[1].click();
    expect(onSelect).toHaveBeenCalledWith('public', 'insert');

    buttons[2].click();
    expect(onSelect).toHaveBeenCalledWith('editor', 'select');
  });

  it('should use custom action labels', () => {
    renderGrid({
      actions: ['insert', 'select'],
      actionLabels: {
        insert: 'Upload',
        select: 'Download',
        update: 'Replace',
        delete: 'Delete',
      },
    });

    expect(
      screen.getByRole('columnheader', { name: 'Upload' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Download' }),
    ).toBeInTheDocument();
  });
});
