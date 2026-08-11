import { expect, it, vi } from 'vitest';
import DataGridCellProvider from '@/features/orgs/projects/storage/dataGrid/components/DataGridCell/DataGridCellProvider';
import { render, screen } from '@/tests/testUtils';
import type { DataGridBooleanCellProps } from './DataGridBooleanCell';
import DataGridBooleanCell from './DataGridBooleanCell';

function renderCell(
  meta: { isEditable: boolean; isNullable?: boolean },
  optimisticValue: boolean | null = true,
) {
  const props = {
    cell: {
      id: 'row-1_col',
      column: {
        getSize: () => 140,
        columnDef: { meta },
      },
    },
    optimisticValue,
    onSave: vi.fn(),
    onTemporaryValueChange: vi.fn(),
    onOptimisticValueChange: vi.fn(),
  } as unknown as DataGridBooleanCellProps;

  return render(
    <DataGridCellProvider>
      <DataGridBooleanCell {...props} />
    </DataGridCellProvider>,
  );
}

describe('DataGridBooleanCell', () => {
  it('renders a clickable trigger when the column is editable', () => {
    renderCell({ isEditable: true });

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders a read-only toggle without a trigger when the column is not editable', () => {
    renderCell({ isEditable: false });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
  });

  it('renders a read-only toggle when meta is missing isEditable', () => {
    renderCell({ isEditable: undefined as unknown as boolean }, false);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('false')).toBeInTheDocument();
  });
});
