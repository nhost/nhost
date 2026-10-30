import { createRef } from 'react';
import {
  DataGridCellContext,
  type DataGridCellContextProps,
} from '@/features/orgs/projects/storage/dataGrid/components/DataGridCell';
import { render, screen } from '@/tests/testUtils';
import type { DataGridTextCellProps } from './DataGridTextCell';
import DataGridTextCell from './DataGridTextCell';

function renderEditingCell(baseType: string, temporaryValue: unknown) {
  const context: DataGridCellContextProps = {
    cellRef: createRef(),
    inputRef: createRef(),
    isEditing: true,
    isSelected: true,
    editCell: vi.fn(),
    cancelEditCell: vi.fn(),
    selectCell: vi.fn(),
    deselectCell: vi.fn(),
    focusCell: vi.fn(),
    blurCell: vi.fn(),
    focusInput: vi.fn(),
    blurInput: vi.fn(),
    clickInput: vi.fn(),
    focusNextCell: vi.fn(),
    focusPrevCell: vi.fn(),
  };

  const props = {
    cell: {
      id: 'row-1_col',
      column: { columnDef: { meta: { baseType, isNullable: false } } },
    },
    optimisticValue: temporaryValue,
    temporaryValue,
    onSave: vi.fn(),
    onTemporaryValueChange: vi.fn(),
    onOptimisticValueChange: vi.fn(),
  } as unknown as DataGridTextCellProps;

  return render(
    <DataGridCellContext.Provider value={context}>
      <DataGridTextCell {...props} />
    </DataGridCellContext.Provider>,
  );
}

describe('DataGridTextCell', () => {
  it.each(['geometry', 'geography', 'extensions.geometry'])(
    'edits %s values in a multiline text area',
    (baseType) => {
      const point = { type: 'Point', coordinates: [1, 2] };

      renderEditingCell(baseType, point);

      const textArea = screen.getByRole('textbox');

      expect(textArea.tagName).toBe('TEXTAREA');
      expect(textArea).toHaveValue(JSON.stringify(point));
    },
  );

  it('edits other scalar values in a single-line input', () => {
    renderEditingCell('uuid', '7f3c1a1e-1111-4a4a-9b9b-000000000000');

    expect(screen.getByRole('textbox').tagName).toBe('INPUT');
  });
});
