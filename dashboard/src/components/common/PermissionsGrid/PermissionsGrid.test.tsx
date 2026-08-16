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

  it('should render contextual admin cells without buttons', () => {
    renderGrid({ roles: [] });

    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(
      screen.getByRole('cell', { name: 'admin insert: full access' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('cell', { name: 'admin select: full access' }),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('should render role names', () => {
    renderGrid({ roles: ['public', 'editor'] });

    expect(screen.getByText('public')).toBeInTheDocument();
    expect(screen.getByText('editor')).toBeInTheDocument();
  });

  it('should expose contextual names for each access level', () => {
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

    expect(
      screen.getByRole('button', { name: 'user insert: full access' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'user select: partial access' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'user update: no access' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'user delete: full access' }),
    ).toBeInTheDocument();
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

    screen.getByRole('button', { name: 'public select: no access' }).click();
    expect(onSelect).toHaveBeenCalledWith('public', 'select');

    screen.getByRole('button', { name: 'public insert: no access' }).click();
    expect(onSelect).toHaveBeenCalledWith('public', 'insert');

    screen.getByRole('button', { name: 'editor select: no access' }).click();
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
    expect(
      screen.getByRole('button', { name: 'public upload: no access' }),
    ).toBeInTheDocument();
  });

  it('should accept actions outside database permissions', () => {
    render(
      <PermissionsGrid
        roles={['user']}
        actions={['execute']}
        actionLabels={{ execute: 'Execute' }}
        getAccessLevel={() => 'full'}
        onSelect={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'user execute: full access' }),
    ).toBeInTheDocument();
  });
});
