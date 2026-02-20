import type { ColumnDef } from '@tanstack/react-table';
import { expect, it } from 'vitest';
import { render, screen } from '@/tests/testUtils';
import DataGrid from './DataGrid';

type MockDataDetails = {
  id: number;
  name: string;
};

const mockColumns: ColumnDef<MockDataDetails>[] = [
  { id: 'id', header: 'ID', accessorKey: 'id' },
  { id: 'name', header: 'Name', accessorKey: 'name' },
];

const mockData: MockDataDetails[] = [
  { id: 1, name: 'foo' },
  { id: 2, name: 'bar' },
];

describe('DataGrid', () => {
  it('should render an empty state if columns are not available', () => {
    render(<DataGrid columns={[]} data={[]} />);

    expect(screen.getByText(/columns not found/i)).toBeInTheDocument();
  });

  it('should render columns and empty state message if data is unavailable', async () => {
    render(<DataGrid columns={mockColumns} data={[]} />);

    expect(await screen.findByRole('table')).toBeInTheDocument();

    expect(
      screen.getByRole('columnheader', { name: /id/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: /name/i }),
    ).toBeInTheDocument();

    expect(screen.getByText(/no data is available/i)).toBeInTheDocument();
  });

  it('should render custom empty state message if data is unavailable', async () => {
    const customEmptyStateMessage = 'custom empty state message';

    render(
      <DataGrid
        columns={mockColumns}
        data={[]}
        emptyStateMessage={customEmptyStateMessage}
      />,
    );

    expect(
      await screen.findByText(customEmptyStateMessage),
    ).toBeInTheDocument();
  });

  it('should display a loading indicator', async () => {
    render(<DataGrid columns={mockColumns} data={[]} loading />);

    expect(await screen.findByRole('progressbar')).toBeInTheDocument();
  });

  it('should render data if provided', async () => {
    render(<DataGrid columns={mockColumns} data={mockData} />);

    expect(await screen.findAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('cell', { name: /1/i })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: /foo/i })).toBeInTheDocument();
  });
});
