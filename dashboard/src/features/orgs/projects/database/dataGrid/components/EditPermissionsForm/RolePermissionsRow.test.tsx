import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAction } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { render, screen } from '@/tests/testUtils';
import RolePermissionsRow from './RolePermissionsRow';

describe('RolePermissionsRow', () => {
  it('should render the role name in the first cell', () => {
    render(
      <table>
        <tbody>
          <RolePermissionsRow
            name="editor"
            disabled
            accessLevels={{
              insert: 'none',
              select: 'none',
              update: 'none',
              delete: 'none',
            }}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText('editor')).toBeInTheDocument();
  });

  it('should render all 4 action columns by default', () => {
    render(
      <table>
        <tbody>
          <RolePermissionsRow
            name="user"
            disabled
            accessLevels={{
              insert: 'full',
              select: 'full',
              update: 'none',
              delete: 'none',
            }}
          />
        </tbody>
      </table>,
    );

    const allCells = screen.getAllByRole('cell');
    expect(allCells).toHaveLength(5);
  });

  it('should render only the select column when actions is ["select"]', () => {
    render(
      <table>
        <tbody>
          <RolePermissionsRow
            name="user"
            disabled
            actions={['select']}
            accessLevels={{
              insert: 'none',
              select: 'full',
              update: 'none',
              delete: 'none',
            }}
          />
        </tbody>
      </table>,
    );

    const allCells = screen.getAllByRole('cell');
    expect(allCells).toHaveLength(2);
  });

  it('should call onActionSelect with the correct action when a cell is clicked', () => {
    const onActionSelect = vi.fn();

    render(
      <table>
        <tbody>
          <RolePermissionsRow
            name="user"
            actions={['select', 'insert']}
            onActionSelect={onActionSelect}
            accessLevels={{
              insert: 'none',
              select: 'none',
              update: 'none',
              delete: 'none',
            }}
          />
        </tbody>
      </table>,
    );

    const buttons = screen.getAllByRole('button');
    const selectButton = buttons[0];
    const insertButton = buttons[1];
    selectButton.click();
    expect(onActionSelect).toHaveBeenCalledWith('select');

    insertButton.click();
    expect(onActionSelect).toHaveBeenCalledWith('insert');
  });

  it('should not render action buttons when disabled', () => {
    render(
      <table>
        <tbody>
          <RolePermissionsRow
            name="admin"
            disabled
            actions={['select', 'insert'] as DatabaseAction[]}
            accessLevels={{
              insert: 'full',
              select: 'full',
              update: 'none',
              delete: 'none',
            }}
          />
        </tbody>
      </table>,
    );

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
