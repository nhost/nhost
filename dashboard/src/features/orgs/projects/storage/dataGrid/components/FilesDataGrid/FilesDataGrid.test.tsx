import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { DataGridQueryParamsProvider } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { DATA_GRID_FILTER_STORAGE_KEY } from '@/features/orgs/projects/database/dataGrid/utils/PersistentDataGridFilterStorage';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen, waitFor } from '@/tests/testUtils';
import FilesDataGrid from './FilesDataGrid';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

const bucketId = 'bucket-1';

const mockBucket = {
  id: bucketId,
  maxUploadFileSize: 50_000_000,
  minUploadFileSize: 0,
  presignedUrlsEnabled: false,
  downloadExpiration: 30,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  cacheControl: 'max-age=3600',
};

function renderFilesDataGrid() {
  return render(
    <DataGridQueryParamsProvider storageKey={`storage:${bucketId}`}>
      <FilesDataGrid bucket={mockBucket} />
    </DataGridQueryParamsProvider>,
  );
}

let capturedFilesVariables: Record<string, unknown> | undefined;
let capturedAggregateVariables: Record<string, unknown> | undefined;

const getFilesHandler = nhostGraphQLLink.query('getFiles', ({ variables }) => {
  capturedFilesVariables = variables;
  return HttpResponse.json({
    data: { files: [] },
  });
});

const getFilesAggregateHandler = nhostGraphQLLink.query(
  'getFilesAggregate',
  ({ variables }) => {
    capturedAggregateVariables = variables;
    return HttpResponse.json({
      data: {
        filesAggregate: { aggregate: { count: 0 } },
      },
    });
  },
);

const server = setupServer(
  tokenQuery,
  getProjectQuery,
  getFilesHandler,
  getFilesAggregateHandler,
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  capturedFilesVariables = undefined;
  capturedAggregateVariables = undefined;
  localStorage.removeItem(DATA_GRID_FILTER_STORAGE_KEY);
});
afterAll(() => server.close());

describe('FilesDataGrid integration', () => {
  beforeEach(() => {
    mocks.useRouter.mockReturnValue({
      pathname: '/orgs/xyz/projects/test-project/storage/[bucketId]',
      query: { orgSlug: 'xyz', appSubdomain: 'test-project', bucketId },
      push: vi.fn(),
      replace: vi.fn(),
      events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
      isReady: true,
    });
  });

  it('passes only the bucket filter to the query when no filters are active', async () => {
    renderFilesDataGrid();

    await waitFor(() => {
      expect(capturedFilesVariables).toBeDefined();
    });

    expect(capturedFilesVariables?.where).toEqual({
      bucketId: { _eq: bucketId },
    });
    expect(capturedAggregateVariables?.where).toEqual({
      bucketId: { _eq: bucketId },
    });
  });

  it('passes filter conditions in the where clause when filters are seeded in localStorage', async () => {
    const filters = [
      { id: 'f1', column: 'name', op: 'ILIKE', value: '%test%' },
    ];
    localStorage.setItem(
      DATA_GRID_FILTER_STORAGE_KEY,
      JSON.stringify({ [`storage:${bucketId}`]: filters }),
    );

    renderFilesDataGrid();

    await waitFor(() => {
      expect(capturedFilesVariables).toBeDefined();
    });

    const expectedWhere = {
      _and: [{ bucketId: { _eq: bucketId } }, { name: { _ilike: '%test%' } }],
    };

    expect(capturedFilesVariables?.where).toEqual(expectedWhere);
    expect(capturedAggregateVariables?.where).toEqual(expectedWhere);
  });

  it('shows "No matches found" and a reset button when filters are active', async () => {
    const filters = [
      { id: 'f1', column: 'mimeType', op: '=', value: 'image/png' },
    ];
    localStorage.setItem(
      DATA_GRID_FILTER_STORAGE_KEY,
      JSON.stringify({ [`storage:${bucketId}`]: filters }),
    );

    renderFilesDataGrid();

    await waitFor(() => {
      expect(screen.getByText(/No matches found/)).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: 'Click here to reset your filters',
        }),
      ).toBeInTheDocument();
    });
  });

  it('shows "No files are uploaded yet." when no filters are active', async () => {
    renderFilesDataGrid();

    await waitFor(() => {
      expect(
        screen.getByText('No files are uploaded yet.'),
      ).toBeInTheDocument();
    });
  });
});
