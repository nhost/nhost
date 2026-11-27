import type { Row } from '@tanstack/react-table';
import { vi } from 'vitest';
import type { DataBrowserColumnMetadata } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { UnknownDataGridRow } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import EditRecordForm from './EditRecordForm';

const mocks = vi.hoisted(() => ({
  updateRow: vi.fn(),
}));

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useUpdateRecordMutation',
  () => ({
    useUpdateRecordMutation: () => ({
      mutateAsync: mocks.updateRow,
      error: null,
      reset: vi.fn(),
    }),
  }),
);

const columns: DataBrowserColumnMetadata[] = [
  {
    id: 'id',
    isPrimary: true,
    isNullable: false,
    specificType: 'uuid',
    baseType: 'uuid',
    isArray: false,
    displayType: 'uuid',
  },
  {
    id: 'priorities',
    isNullable: false,
    specificType: 'text[]',
    baseType: 'text',
    isArray: true,
    displayType: 'text[]',
  },
];

const row = {
  original: {
    id: '4b2f3a0c-6f1e-4c5d-9a8b-7c6d5e4f3a2b',
    priorities: ['low', 'normal', 'high', 'urgent'],
  },
} as unknown as Row<UnknownDataGridRow>;

describe('EditRecordForm', () => {
  beforeEach(() => {
    mocks.updateRow.mockReset();
    mocks.updateRow.mockResolvedValue(undefined);
  });

  it('shows array values as JSON arrays', () => {
    render(<EditRecordForm row={row} columns={columns} currentOffset={0} />);

    expect(screen.getByRole('textbox', { name: /priorities/i })).toHaveValue(
      '["low","normal","high","urgent"]',
    );
  });

  it('sends an edited array value as a JSON array', async () => {
    const user = new TestUserEvent();
    render(<EditRecordForm row={row} columns={columns} currentOffset={0} />);

    const input = screen.getByRole('textbox', { name: /priorities/i });
    await user.clear(input);
    await user.type(input, '[["low","high"]');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mocks.updateRow).toHaveBeenCalledWith({
        row,
        columnsToUpdate: { priorities: { value: '["low","high"]' } },
      });
    });
  });
});
