import permissionVariablesQuery from '@/tests/msw/mocks/graphql/permissionVariablesQuery';
import { hasuraRelationShipsMetadataQuery } from '@/tests/msw/mocks/rest/hasuraMetadataQuery';
import tableQuery from '@/tests/msw/mocks/rest/tableQuery';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import '@testing-library/jest-dom';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, test, vi } from 'vitest';
import ColumnAutocomplete from './ColumnAutocomplete';

mockPointerEvent();

function getRouter() {
  return {
    basePath: '',
    pathname: '/orgs/xyz/projects/test-project',
    route: '/orgs/[orgSlug]/projects/[appSubdomain]',
    asPath: '/orgs/xyz/projects/test-project',
    isLocaleDomain: false,
    isReady: true,
    isPreview: false,
    query: {
      orgSlug: 'xyz',
      appSubdomain: 'test-project',
      dataSourceSlug: 'default',
    },
    push: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    beforePopState: vi.fn(),
    events: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
    isFallback: false,
  };
}

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual<any>('@/lib/utils');
  return {
    ...actual,
    cn: (...classes: (string | undefined)[]) =>
      classes.filter(Boolean).join(' '),
  };
});

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

const server = setupServer(
  tableQuery,
  permissionVariablesQuery,
  hasuraRelationShipsMetadataQuery,
);

describe('ColumnAutocomplete', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'warn' });
    process.env.NEXT_PUBLIC_ENV = 'dev';
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => {
    server.close();
    vi.restoreAllMocks();
  });

  test('show nested relationships', async () => {
    mocks.useRouter.mockImplementation(() => getRouter());
    await waitFor(() => {
      render(<ColumnAutocomplete schema="public" table="town" />);
    });

    await TestUserEvent.fireClickEvent(screen.getByText('Select a column'));
    const relationShipOption = screen.getByRole('option', { name: 'county' });
    expect(relationShipOption).toBeInTheDocument();

    await TestUserEvent.fireClickEvent(
      screen.getByRole('option', { name: 'county' }),
    );
    expect(relationShipOption).not.toBeInTheDocument();

    expect(screen.getByText('town.county')).toBeInTheDocument();
    expect(screen.getByText('relationships')).toBeInTheDocument();
    expect(screen.getByText('country')).toBeInTheDocument();
  });
});

// Note: Network requests don't go through in tests, so we can't test the
// autocomplete functionality for now.
