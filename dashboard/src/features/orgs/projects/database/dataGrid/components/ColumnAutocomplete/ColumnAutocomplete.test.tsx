import permissionVariablesQuery from '@/tests/msw/mocks/graphql/permissionVariablesQuery';
import hasuraMetadataQuery from '@/tests/msw/mocks/rest/hasuraMetadataQuery';
import tableQuery from '@/tests/msw/mocks/rest/tableQuery';
import { render, screen } from '@/tests/testUtils';
import '@testing-library/jest-dom';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, test, vi } from 'vitest';
import ColumnAutocomplete from './ColumnAutocomplete';

vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' '),
}));

const server = setupServer(
  tableQuery,
  hasuraMetadataQuery,
  permissionVariablesQuery,
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => {
  server.close();
  vi.restoreAllMocks();
});

test('should render a combobox', () => {
  render(<ColumnAutocomplete schema="public" table="books" />);

  expect(screen.getByRole('combobox')).toBeInTheDocument();
});

// Note: Network requests don't go through in tests, so we can't test the
// autocomplete functionality for now.
