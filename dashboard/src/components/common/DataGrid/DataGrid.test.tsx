import { render, screen } from '@/tests/testUtils';
import type { Column } from 'react-table';
import { expect, test } from 'vitest';
import DataGrid from './DataGrid';

interface MockDataDetails {
  id: number;
  name: string;
}

const mockColumns: Column<MockDataDetails>[] = [
  { id: 'id', Header: 'ID', accessor: 'id' },
  { id: 'name', Header: 'Name', accessor: 'name' },
];

const mockData: MockDataDetails[] = [
  { id: 1, name: 'foo' },
  { id: 2, name: 'bar' },
];

test('should render an empty state if columns are not available', () => {
  render(<DataGrid columns={[]} data={[]} />);

  expect(screen.getByText(/columns not found/i)).toBeInTheDocument();
});

test('should render columns and empty state message if data is unavailable', () => {
  render(<DataGrid columns={mockColumns} data={[]} />);

  expect(screen.getByRole('table')).toBeInTheDocument();

  expect(screen.getByRole('columnheader', { name: /id/i })).toBeInTheDocument();
  expect(
    screen.getByRole('columnheader', { name: /name/i }),
  ).toBeInTheDocument();

  expect(screen.getByText(/no data is available/i)).toBeInTheDocument();
});

test('should render custom empty state message if data is unavailable', () => {
  const customEmptyStateMessage = 'custom empty state message';

  render(
    <DataGrid
      columns={mockColumns}
      data={[]}
      emptyStateMessage={customEmptyStateMessage}
    />,
  );

  expect(screen.getByText(customEmptyStateMessage)).toBeInTheDocument();
});

test('should display a loading indicator', async () => {
  render(<DataGrid columns={mockColumns} data={[]} loading />);

  // Activity indicator is not immediately displayed, so we need to wait
  expect(await screen.findByRole('progressbar')).toBeInTheDocument();
});

test('should render data if provided', () => {
  render(<DataGrid columns={mockColumns} data={mockData} />);

  expect(screen.getAllByRole('row')).toHaveLength(2);
  expect(screen.getByRole('cell', { name: /1/i })).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: /foo/i })).toBeInTheDocument();
});
