import customClaimsQuery from '@/utils/msw/mocks/graphql/customClaimsQuery';
import hasuraMetadataQuery from '@/utils/msw/mocks/rest/hasuraMetadataQuery';
import tableQuery from '@/utils/msw/mocks/rest/tableQuery';
import { render, screen } from '@/utils/testUtils';
import { setupServer } from 'msw/node';
import { test, vi } from 'vitest';
import ColumnAutocomplete from './ColumnAutocomplete';

const server = setupServer(tableQuery, hasuraMetadataQuery, customClaimsQuery);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => {
  server.close();
  vi.restoreAllMocks();
});

test('should render a combobox', () => {
  render(
    <ColumnAutocomplete
      schema="public"
      table="books"
      label="Column Autocomplete"
    />,
  );

  expect(
    screen.getByRole('combobox', { name: /column autocomplete/i }),
  ).toBeInTheDocument();
});

// Note: Network requests don't go through in tests, so we can't test the
// autocomplete functionality for now.
